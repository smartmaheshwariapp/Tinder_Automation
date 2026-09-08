// PlatformSelectScreen.js — FlirtEasy AI Cockpit (Root Home Screen)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  Animated,
  Modal,
  Dimensions,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getAutoDetectedLocalIp, resolveLocalUrl, postJsonWithTimeout } from '../utils/network';
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
} from '../utils/sessionManager';
import useExtensionStats from '../hooks/useExtensionStats';
import { DashboardPanel } from '../components/dashboard';
import SupabaseService from '../services/supabase';
import NotificationService from '../services/notifications';
import NotificationCenterModal from '../components/NotificationCenterModal';
import PermissionPrePromptModal from '../components/common/PermissionPrePromptModal';
import LocationNoticeModal from '../components/common/LocationNoticeModal';
import LocationService from '../services/locationService';

const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const TINDER_IMG = require('../../assets/flirteasy/tinder.jpg');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlatformSelectScreen({ navigation, route }) {
  const [selectedPlatform, setSelectedPlatform] = useState('Tinder');
  const [environment, setEnvironmentState] = useState(() => getSelectedEnvironment() || 'on_device');
  const setEnvironment = useCallback((env) => {
    setSelectedEnvironment(env);
    setEnvironmentState(env);
  }, []);
  const [userRegion, setUserRegion] = useState('israel'); // 'israel' | 'direct'
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  // Connection endpoints
  const [vpsUrl, setVpsUrl] = useState('https://stream.smartmaheshwari.com/?usr=User&pwd=admin');
  const [vpsProxy, setVpsProxy] = useState('http://*****:*****@46.203.181.164:43343');

  const autoIp = getAutoDetectedLocalIp();
  const [localUrl, setLocalUrl] = useState(`http://${autoIp}:8080/?usr=User&pwd=admin`);
  const [localProxy, setLocalProxy] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [updatingGpsLocation, setUpdatingGpsLocation] = useState(false);
  const [locationNoticeModal, setLocationNoticeModal] = useState(null);

  const handleLocationAcquired = useCallback((res) => {
    if (res && res.cityName && res.latitude && res.longitude) {
      setLocalSettings(prev => {
        const updated = {
          ...(prev || {}),
          useDeviceLocation: true,
          locationCity: res.cityName,
          locationLatitude: res.latitude,
          locationLongitude: res.longitude,
        };
        setSharedExtensionSettings(updated);
        return updated;
      });
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
          type: 'connected',
          title: 'Location Connected',
          cityName: res.cityName,
        });
      } else if (res?.code === 'SERVICES_DISABLED') {
        setLocationNoticeModal({
          visible: true,
          type: 'services_disabled',
          title: 'Location Turned Off',
          message: res.error,
        });
      } else if (res?.code === 'PERMISSION_BLOCKED' || res?.canAskAgain === false) {
        setLocationNoticeModal({
          visible: true,
          type: 'access_needed',
          title: 'Location Access Needed',
          message: res.error,
        });
      } else {
        setLocationNoticeModal({
          visible: true,
          type: 'access_needed',
          title: 'Location Access Needed',
          message: res?.error || 'Location access was not granted.',
        });
      }
    } catch (e) {
      setLocationNoticeModal({
        visible: true,
        type: 'notice',
        title: 'Location Notice',
        message: e.message || 'Could not update location.',
      });
    } finally {
      setUpdatingGpsLocation(false);
    }
  }, [updatingGpsLocation, handleLocationAcquired]);

  // ── Login Detection State ──
  const [isLoggedIn, setIsLoggedIn] = useState(() => getTinderAuthState()?.isLoggedIn ?? null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Synchronous re-entrancy lock for handleLogout.
  const loggingOutRef = useRef(false);
  const [signedOutToast, setSignedOutToast] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Synced Parent Agent State & Settings (Unified Master Control) ──
  const [agentState, setAgentState] = useState(() => getSharedAgentState());
  const [localSettings, setLocalSettings] = useState(() => getSharedExtensionSettings());

  useEffect(() => {
    const unsubAgent = subscribeSharedAgentState(setAgentState);
    const unsubSettings = subscribeSharedExtensionSettings(setLocalSettings);
    const unsubAuth = subscribeTinderAuthState((auth) => {
      if (auth && typeof auth.isLoggedIn === 'boolean') {
        setIsLoggedIn(auth.isLoggedIn);
      }
    });
    return () => {
      unsubAgent();
      unsubSettings();
      unsubAuth();
    };
  }, []);

  const handleSaveSettings = useCallback(async (updatedSettings) => {
    const merged = { ...localSettings, ...updatedSettings };
    setLocalSettings(merged);
    setSharedExtensionSettings(merged);
    const userId = route?.params?.userId;
    if (userId) {
      SupabaseService.saveUserSnapshot(userId, {
        platform: 'tinder',
        settings: merged,
      }).catch(() => {});
    }
    return true;
  }, [localSettings, route?.params?.userId]);

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
        .catch(() => {});
    }
  }, []);

  const handlePermissionModalClose = useCallback(() => {
    setShowPermissionModal(false);
    setHasPromptedPermissions(true);
  }, []);

  const handlePermissionsGranted = useCallback((res) => {
    setShowPermissionModal(false);
    setHasPromptedPermissions(true);
    handleLocationAcquired(res);
  }, [handleLocationAcquired]);

  useEffect(() => {
    const unsub = NotificationService.subscribeInbox((items) => {
      setUnreadNotifCount(items.filter((i) => !i.is_read).length);
    });
    return unsub;
  }, []);

  // ── Animations ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    const detected = getAutoDetectedLocalIp();
    if (detected && detected !== 'localhost' && localUrl.includes('localhost')) {
      setLocalUrl(`http://${detected}:8080/?usr=User&pwd=admin`);
    }
  }, []);

  const activeStreamUrl = environment === 'on_device'
    ? 'on_device'
    : (environment === 'hyperbeam'
      ? 'hyperbeam'
      : (environment === 'vps' ? vpsUrl : localUrl));

  const activeProxy = environment === 'vps'
    ? (userRegion === 'israel' ? 'http://*****:*****@46.203.181.164:43343' : '')
    : (environment === 'hyperbeam' || environment === 'on_device' ? '' : localProxy);

  const orchestratorUrl = environment === 'on_device'
    ? null
    : (environment === 'vps'
      ? 'https://api.smartmaheshwari.com'
      : resolveLocalUrl('http://localhost:3001'));

  // Stats polling (active only for remote VPS or Local Neko mode)
  const { stats, loading, error, refresh: refreshStats } = useExtensionStats(
    orchestratorUrl,
    environment !== 'on_device'
  );

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auth detection & login status refresh
  const checkAuthStatus = useCallback(async () => {
    // 1. If an explicit logout was performed or purge is pending, force logged-out state
    if (getPendingWebViewPurge()) {
      setIsLoggedIn(false);
      setCheckingAuth(false);
      return;
    }

    // 2. Check in-memory shared & persisted auth state (fastest, immediately available)
    const auth = getTinderAuthState();
    if (auth && typeof auth.isLoggedIn === 'boolean') {
      setIsLoggedIn(auth.isLoggedIn);
      setCheckingAuth(false);
      if (auth.isLoggedIn) return;
    }

    // 3. For On-Device mode, auth is managed strictly by the local on-device WebView and content script.
    // Do NOT infer login from past swipes or remote orchestrator in on_device mode.
    if (environment === 'on_device') {
      setIsLoggedIn(Boolean(auth?.isLoggedIn));
      setCheckingAuth(false);
      return;
    }

    const cachedProfile = localSettings?.userProfile;

    // 4. Remote/VPS mode: Check live status from orchestrator if explicitly logged in
    if (stats && stats.tinderAccount?.isLoggedIn) {
      setTinderAuthState({
        isLoggedIn: true,
        accountName: stats.tinderAccount?.name || cachedProfile?.name || 'Tinder Account',
        accountEmail: stats.tinderAccount?.email || null,
      });
      setIsLoggedIn(true);
      setCheckingAuth(false);
      return;
    }

    // 5. Query backend orchestrator for active page and auth state (Neko mode)
    const backendUrl = orchestratorUrl || (environment === 'vps' ? 'https://api.smartmaheshwari.com' : resolveLocalUrl('http://localhost:3001'));
    if (backendUrl) {
      try {
        const pageStateRes = await fetch(`${backendUrl}/check-page-state`).then(r => r.json()).catch(() => null);
        if (pageStateRes?.state === 'logged_in') {
          setTinderAuthState({ isLoggedIn: true, accountName: cachedProfile?.name || 'Tinder Account' });
          setIsLoggedIn(true);
          setCheckingAuth(false);
          return;
        }

        const authStatusRes = await fetch(`${backendUrl}/auth-status`).then(r => r.json()).catch(() => null);
        if (authStatusRes?.success && authStatusRes.isLoggedIn) {
          setTinderAuthState({ isLoggedIn: true, accountName: cachedProfile?.name || 'Tinder Account' });
          setIsLoggedIn(true);
          setCheckingAuth(false);
          return;
        }
      } catch (_) {}
    }

    // Default to false if no live verification confirms logged in
    setIsLoggedIn(false);
    setCheckingAuth(false);
  }, [stats, localSettings, orchestratorUrl, environment]);

  useFocusEffect(
    useCallback(() => {
      const savedEnv = getSelectedEnvironment();
      if (savedEnv) {
        setEnvironmentState((prev) => (prev !== savedEnv ? savedEnv : prev));
      }
      checkAuthStatus();

      // Hydrate userProfile and settings from backend orchestrator if reachable
      const backendUrl = orchestratorUrl || (environment === 'vps' ? 'https://api.smartmaheshwari.com' : resolveLocalUrl('http://localhost:3001'));
      if (backendUrl) {
        fetch(`${backendUrl}/extension-settings`)
          .then(r => r.json())
          .then(data => {
            if (data?.success && data.settings?.userProfile && (data.settings.userProfile.name || data.settings.userProfile.bio)) {
              setLocalSettings(prev => {
                const merged = { ...(prev || {}), ...data.settings };
                setSharedExtensionSettings(merged);
                return merged;
              });
              // NOTE: Do NOT call setTinderAuthState/setIsLoggedIn here.
              // The extension-settings profile is stale context — it doesn't prove
              // the user is currently logged in (profile persists after logout).
              // Auth state is managed solely by the content.js watchdog and explicit
              // FE_AUTH_STEP messages from the browser WebView.
            }
          })
          .catch(() => {});
      }
    }, [checkAuthStatus, orchestratorUrl, environment])
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
  const handleOpenLiveFeed = useCallback(async (platformName, extraParams = {}) => {
    const targetPlatform = typeof platformName === 'string' ? platformName : selectedPlatform;
    const realProxy = activeProxy === 'http://*****:*****@46.203.181.164:43343'
      ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
      : activeProxy;

    if (environment === 'hyperbeam') {
      setStartingSession(true);
      try {
        const { embedUrl } = await startHyperbeamCloudSession({
          platform: targetPlatform,
          proxyIp: realProxy,
          orchestratorUrl,
        });
        setStartingSession(false);
        navigation.navigate('Browser', {
          vpsUrl: embedUrl,
          platform: targetPlatform,
          environment: 'hyperbeam',
          isHyperbeam: true,
          proxyIp: realProxy,
          orchestratorUrl,
          ...extraParams,
        });
      } catch (err) {
        setStartingSession(false);
        console.error('[PlatformSelectScreen] Hyperbeam start error:', err);
        Alert.alert(
          'Hyperbeam Connection Error',
          `Could not connect to Hyperbeam: ${err.message}\n\nPlease verify your Hyperbeam API key or switch to VPS / Local in Settings.`,
          [
            { text: 'Settings', onPress: openModal },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
      return;
    }

    const resolvedUrl = resolveLocalUrl(activeStreamUrl);
    const needPurge = Boolean(getPendingWebViewPurge() || !isLoggedIn);

    navigation.navigate('Browser', {
      vpsUrl: resolvedUrl,
      platform: targetPlatform,
      environment: environment,
      isOnDevice: environment === 'on_device',
      proxyIp: realProxy,
      orchestratorUrl,
      forceLogout: needPurge,
      clearSession: needPurge,
      ...extraParams,
    });
  }, [navigation, activeProxy, activeStreamUrl, environment, selectedPlatform, orchestratorUrl, isLoggedIn]);

  // Toggle agent (handles both local on-device automation and remote orchestrator CDP)
  const handleToggleAgent = useCallback(async () => {
    if (environment === 'on_device') {
      const currentState = getSharedAgentState();
      const nextRunning = !currentState?.agentState?.isRunning;
      updateSharedAgentState({
        agentState: {
          isRunning: nextRunning,
          isPaused: !nextRunning,
          currentPhase: nextRunning ? 'liking' : 'stopped',
        }
      });
      // If user tapped Start Agent from the Home Screen, launch live browser with auto-start
      if (nextRunning) {
        handleOpenLiveFeed('Tinder', { autoStartAgent: true, isOnDevice: true });
      }
      return;
    }
    try {
      const isRunning = Boolean(
        stats?.agentState?.isRunning ||
        (stats?.agentState?.currentPhase && stats.agentState.currentPhase !== 'stopped')
      );
      const endpoint = isRunning ? '/stop-agent' : '/start-agent';
      await fetch(`${orchestratorUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'Tinder' }),
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
        currentPhase: 'stopped',
        stats: { swipes: 0, matches: 0, messages: 0, likesCompleted: 0, matchesCreated: 0, messagesSent: 0 },
      },
      lifetimeStats: { totalLikes: 0, matchesCreated: 0, messagesSent: 0, activeConversations: 0 },
      progressFeed: [],
    });

    // 4. Send logout to backend orchestrator if reachable.
    // Best-effort and bounded: local state is already cleared, and both modal
    // buttons are disabled while this runs, so an unreachable backend must never
    // be able to strand the user on the spinner.
    const backendUrl = orchestratorUrl || (environment === 'vps' ? 'https://api.smartmaheshwari.com' : resolveLocalUrl('http://localhost:3001'));
    if (backendUrl) {
      const acknowledged = await postJsonWithTimeout(`${backendUrl}/logout`, {
        userId: route?.params?.userId || 'dev_user_1',
        platform: 'tinder',
      });
      if (!acknowledged) {
        console.warn('[PlatformSelect] Orchestrator did not acknowledge logout; local session already cleared.');
      }
    }

    if (refreshStats) {
      setTimeout(refreshStats, 400);
      setTimeout(refreshStats, 1200);
    }
    loggingOutRef.current = false;
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, [orchestratorUrl, environment, refreshStats, route?.params?.userId]);

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

  const handleLaunch = useCallback((platformName) => {
    const targetPlatform = typeof platformName === 'string' ? platformName : selectedPlatform;
    const realProxy = activeProxy === 'http://*****:*****@46.203.181.164:43343'
      ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
      : activeProxy;

    const resolvedUrl = environment === 'hyperbeam' ? 'hyperbeam' : resolveLocalUrl(activeStreamUrl);

    navigation.navigate('PlatformConfig', {
      platform: targetPlatform,
      vpsUrl: resolvedUrl,
      environment: environment,
      proxyIp: realProxy,
    });
  }, [navigation, activeProxy, activeStreamUrl, environment, selectedPlatform]);

  const handleOpenCloudHub = useCallback(() => {
    const realProxy = activeProxy === 'http://*****:*****@46.203.181.164:43343'
      ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
      : activeProxy;

    navigation.navigate('CloudDashboard', {
      orchestratorUrl,
      vpsUrl: environment === 'hyperbeam' ? 'hyperbeam' : resolveLocalUrl(activeStreamUrl),
      platform: selectedPlatform,
      proxyIp: realProxy,
    });
  }, [navigation, orchestratorUrl, environment, activeStreamUrl, activeProxy, selectedPlatform]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09080E" />

      {/* Confirms the sign-out that just closed the browser session, so the
          screen change does not read as a crash. Deliberately local rather than
          the app-wide notification banner, which always offers an "Open Tinder"
          action and would contradict the message. */}
      {signedOutToast && (
        <View style={styles.signedOutToast} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.signedOutToastText}>Signed out of Tinder</Text>
        </View>
      )}

      {/* ═══════════════════ HEADER BAR ═══════════════════ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={LOGO_IMG} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.headerTitle}>Linksy</Text>
            <Text style={styles.headerSub}>AI Dating Assistant</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Notification Bell with Badge */}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => setShowNotifModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications-outline" size={18} color="#D8D6E8" />
            {unreadNotifCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Connection Settings Gear */}
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={openModal}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={18} color="#8E8DA3" />
          </TouchableOpacity>

          {/* App Sign Out */}
          <TouchableOpacity
            style={styles.headerSignOutBtn}
            onPress={() => navigation.replace('Auth')}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={17} color="#FE3C72" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══════════════════ UNIFIED TINDER HERO STATUS & PRIMARY ACTION CARD ═══════════════════ */}
      <View style={styles.heroCardContainer}>
        {isLoggedIn ? (
          /* ── Connected / Active Cockpit State ── */
          <View style={styles.heroCardActive}>
            <View style={styles.heroActiveTopRow}>
              <View style={styles.heroActiveLeft}>
                <View style={styles.heroAvatarWrap}>
                  <Image source={TINDER_IMG} style={styles.heroAvatarIcon} />
                  <View style={styles.heroLiveDot} />
                </View>
                <View style={styles.heroActiveInfo}>
                  <View style={styles.heroActiveTitleRow}>
                    <Text style={styles.heroActiveTitle} numberOfLines={1}>
                      {stats?.tinderAccount?.name || stats?.tinderAccount?.email || getTinderAuthState()?.accountName || 'Tinder Account'}
                    </Text>
                    <View style={styles.heroOnlinePill}>
                      <View style={styles.heroPulseDot} />
                      <Text style={styles.heroOnlineText}>ONLINE</Text>
                    </View>
                  </View>
                  <Text style={styles.heroActiveSub} numberOfLines={1}>
                    ✨ Finding singles in {localSettings?.locationCity || 'your area'} • Active
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.heroLogoutBtn}
                onPress={confirmLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Primary Action Row */}
            <View style={styles.heroActiveActionRow}>
              <TouchableOpacity
                style={[styles.heroPrimaryBtn, startingSession && { opacity: 0.8 }]}
                onPress={() => handleOpenLiveFeed('Tinder')}
                disabled={startingSession}
                activeOpacity={0.88}
              >
                {startingSession ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.heroPrimaryBtnText}>Opening Tinder...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="flame" size={16} color="#FFF" />
                    <Text style={styles.heroPrimaryBtnText}>Open Tinder</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroConfigureBtn}
                onPress={() => handleLaunch('Tinder')}
                activeOpacity={0.85}
              >
                <Ionicons name="options-outline" size={15} color="#FE3C72" />
                <Text style={styles.heroConfigureBtnText}>Preferences</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── Disconnected / Action Required State ── */
          <View style={styles.heroCardInactive}>
            <View style={styles.heroInactiveHeader}>
              <View style={styles.heroInactiveIconWrap}>
                <Image source={TINDER_IMG} style={styles.heroInactiveIcon} />
                <View style={styles.heroInactiveDot} />
              </View>
              <View style={styles.heroInactiveTextWrap}>
                <View style={styles.heroInactiveTitleRow}>
                  <Text style={styles.heroInactiveTitle}>Connect Tinder Account</Text>
                  <View style={styles.heroOfflinePill}>
                    <Text style={styles.heroOfflineText}>NOT CONNECTED</Text>
                  </View>
                </View>
                <Text style={styles.heroInactiveSub}>
                  Link your account to activate 24/7 automated swiping, smart matching & conversation
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.heroConnectBtn, startingSession && { opacity: 0.8 }]}
              onPress={() => handleOpenLiveFeed('Tinder')}
              disabled={startingSession}
              activeOpacity={0.88}
            >
              {startingSession ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.heroConnectBtnText}>Starting Tinder Session...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroConnectBtnText}>Connect Tinder Account</Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

          {/* ═══════════════════ MAIN DASHBOARD BODY ═══════════════════ */}
          <Animated.View style={[styles.dashboardWrap, { opacity: fadeAnim }]}>
            <DashboardPanel
              stats={environment === 'on_device' ? agentState : (stats || (isLoggedIn ? agentState : null))}
              loading={environment === 'on_device' ? false : (isLoggedIn ? false : loading)}
              error={environment === 'on_device' ? null : (isLoggedIn ? null : error)}
              orchestratorUrl={orchestratorUrl || (environment === 'vps' ? 'https://api.smartmaheshwari.com' : resolveLocalUrl('http://localhost:3001'))}
              onToggleAgent={handleToggleAgent}
              onLogout={handleLogout}
              onSaveSettings={handleSaveSettings}
              settings={localSettings}
              controlsContent={
                <View style={styles.infoBox}>
                  <View style={styles.infoTitleRow}>
                    <Ionicons name="sparkles" size={16} color="#FE3C72" />
                    <Text style={styles.infoTitle}>
                      {isLoggedIn ? 'Tinder Assistant Active' : 'Getting Started'}
                    </Text>
                  </View>
                  <Text style={styles.infoText}>
                    {isLoggedIn
                      ? 'Your AI assistant continuously evaluates recommendations, filters compatible profiles, and handles intelligent conversations.'
                      : 'Connect your Tinder profile above to start finding matches and chatting automatically.'}
                  </Text>
                </View>
              }
            />
          </Animated.View>

      {/* ═══════════════════ CONNECTION SETTINGS SHEET ═══════════════════ */}
      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <Animated.View
              style={[styles.modalSheet, { transform: [{ translateY: modalSlide }] }]}
            >
              <Pressable onPress={() => { }} /* prevent overlay dismiss */>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>App Preferences</Text>
                  <TouchableOpacity onPress={closeModal} activeOpacity={0.8}>
                    <Ionicons name="close-circle" size={22} color="#716E89" />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* ─── 1. Your Dating Location ─── */}
                  <View style={styles.consumerSectionCard}>
                    <View style={styles.consumerSectionHeader}>
                      <View style={styles.consumerIconWrap}>
                        <Ionicons name="location" size={18} color="#FE3C72" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.consumerCardTitle}>Your Location</Text>
                        <Text style={styles.consumerCardSub}>
                          {localSettings?.useDeviceLocation ? '📍 Current Location' : '🌐 Selected City'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.consumerCityBox}>
                      <Text style={styles.consumerCityName}>{localSettings?.locationCity || 'New York, NY'}</Text>
                      <Text style={styles.consumerCityCoords}>
                        Personalized profiles in this area
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.consumerRefreshGpsBtn}
                      onPress={handleRefreshDeviceLocation}
                      disabled={updatingGpsLocation}
                      activeOpacity={0.85}
                    >
                      {updatingGpsLocation ? (
                        <ActivityIndicator size="small" color="#10B981" />
                      ) : (
                        <>
                          <Ionicons name="locate" size={14} color="#10B981" />
                          <Text style={styles.consumerRefreshGpsText}>Update to Current Location</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* ─── 2. Dating Assistant ─── */}
                  <View style={styles.consumerSectionCard}>
                    <View style={styles.consumerSectionHeader}>
                      <View style={[styles.consumerIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                        <Ionicons name="sparkles" size={18} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.consumerCardTitle}>Dating Assistant</Text>
                        <Text style={styles.consumerCardSub}>Finding matches & starting conversations</Text>
                      </View>
                    </View>
                    <View style={styles.consumerStatusRow}>
                      <Text style={styles.consumerStatusLabel}>Matching Pace</Text>
                      <Text style={styles.consumerStatusVal}>Natural & Active</Text>
                    </View>
                  </View>

                  {/* ─── 3. Developer / Advanced Network (Tucked Away Behind Toggle) ─── */}
                  <TouchableOpacity
                    style={styles.advancedToggleRow}
                    onPress={() => setShowAdvanced(!showAdvanced)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.advancedToggleText}>
                      {showAdvanced ? 'Hide Developer Settings' : '🛠️ Advanced / Developer Options'}
                    </Text>
                    <Ionicons
                      name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color="#8E8DA3"
                    />
                  </TouchableOpacity>

                  {showAdvanced && (
                    <View style={styles.advancedDrawer}>
                      <Text style={styles.modalSectionLabel}>Server Environment</Text>
                      <View style={styles.envSelector}>
                        <TouchableOpacity
                          style={[styles.envOption, environment === 'on_device' && styles.envOptionActive]}
                          onPress={() => setEnvironment('on_device')}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="phone-portrait-outline"
                            size={15}
                            color={environment === 'on_device' ? '#10B981' : '#716E89'}
                          />
                          <Text style={[styles.envOptionText, environment === 'on_device' && styles.envOptionTextActive]}>
                            On-Device
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.envOption, environment === 'hyperbeam' && styles.envOptionActive]}
                          onPress={() => setEnvironment('hyperbeam')}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="flash-outline"
                            size={15}
                            color={environment === 'hyperbeam' ? '#FE3C72' : '#716E89'}
                          />
                          <Text style={[styles.envOptionText, environment === 'hyperbeam' && styles.envOptionTextActive]}>
                            Cloud
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.envOption, environment === 'vps' && styles.envOptionActive]}
                          onPress={() => setEnvironment('vps')}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="cloud-done-outline"
                            size={15}
                            color={environment === 'vps' ? '#FFF' : '#716E89'}
                          />
                          <Text style={[styles.envOptionText, environment === 'vps' && styles.envOptionTextActive]}>
                            VPS
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.envOption, environment === 'local' && styles.envOptionActive]}
                          onPress={() => setEnvironment('local')}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="laptop-outline"
                            size={15}
                            color={environment === 'local' ? '#FFF' : '#716E89'}
                          />
                          <Text style={[styles.envOptionText, environment === 'local' && styles.envOptionTextActive]}>
                            Local
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Active Session & Disconnect */}
                  {isLoggedIn && (
                    <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                      <Text style={styles.modalSectionLabel}>Active Tinder Account</Text>
                      <TouchableOpacity
                        style={styles.modalLogoutBtn}
                        onPress={() => {
                          closeModal();
                          setTimeout(confirmLogout, 250);
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                        <Text style={styles.modalLogoutBtnText}>Log Out & End Session</Text>
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
              <Ionicons name="log-out" size={28} color="#EF4444" />
            </View>

            <Text style={styles.logoutModalTitle}>Log Out of Tinder?</Text>
            <Text style={styles.logoutModalSubtitle}>
              This will end the active Tinder session and pause your AI automation assistant until you sign back in.
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
        type={locationNoticeModal?.type || 'connected'}
        title={locationNoticeModal?.title}
        cityName={locationNoticeModal?.cityName}
        message={locationNoticeModal?.message}
        onClose={() => setLocationNoticeModal(null)}
        onChooseCityManually={() => {
          setLocationNoticeModal(null);
          closeModal();
          navigation.navigate('Browser', { targetSettingsSection: 'location' });
        }}
        onLocationAcquired={handleLocationAcquired}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09080E',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#12101C',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16.5,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FE3C72',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  headerLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FE3C72',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  headerLaunchBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  gearBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSignOutBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(254, 60, 114, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Quick Launch Action Bar (Tinder) ──
  quickLaunchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#151322',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickLaunchPrimaryBtn: {
    flex: 1,
    backgroundColor: '#FE3C72',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  quickLaunchPrimaryText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  quickLaunchSecondaryBtn: {
    backgroundColor: 'rgba(254, 60, 114, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.30)',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickLaunchSecondaryText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Unified Tinder Hero Status & Action Card ──
  heroCardContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  heroCardActive: {
    backgroundColor: '#14121F',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    padding: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  heroActiveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroActiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroAvatarWrap: {
    position: 'relative',
  },
  heroAvatarIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  heroLiveDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#14121F',
  },
  heroActiveInfo: {
    flex: 1,
  },
  heroActiveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroActiveTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroOnlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  heroPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  heroOnlineText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroActiveSub: {
    color: '#8E8DA3',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  heroLogoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActiveActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: '#FE3C72',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroPrimaryBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  heroConfigureBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroConfigureBtnText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Disconnected Hero State */
  heroCardInactive: {
    backgroundColor: '#14121F',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.32)',
    padding: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  heroInactiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  heroInactiveIconWrap: {
    position: 'relative',
  },
  heroInactiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  heroInactiveDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#14121F',
  },
  heroInactiveTextWrap: {
    flex: 1,
  },
  heroInactiveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroInactiveTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroOfflinePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  heroOfflineText: {
    color: '#F59E0B',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroInactiveSub: {
    color: '#8E8DA3',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  heroConnectBtn: {
    backgroundColor: '#FE3C72',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroConnectBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── Dashboard Body ──
  dashboardWrap: {
    flex: 1,
  },

  // ── Settings Info Box ──
  infoBox: {
    backgroundColor: '#14121F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  infoText: {
    color: '#8E8DA3',
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Connection Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  modalKeyboard: {
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#14121F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.72,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3D52',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  consumerSectionCard: {
    backgroundColor: '#161424',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 14,
    marginBottom: 14,
  },
  consumerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  consumerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consumerCardTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  consumerCardSub: {
    color: '#8E8DA3',
    fontSize: 11,
    marginTop: 1,
  },
  consumerCityBox: {
    backgroundColor: '#1E1B2E',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  consumerCityName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  consumerCityCoords: {
    color: '#8E8DA3',
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  consumerRefreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingVertical: 9,
  },
  consumerRefreshGpsText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  consumerStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  consumerStatusLabel: {
    color: '#8E8DA3',
    fontSize: 12,
  },
  consumerStatusVal: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  modalSectionLabel: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  envSelector: {
    flexDirection: 'row',
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  envOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  envOptionActive: {
    backgroundColor: '#26223B',
  },
  envOptionText: {
    color: '#716E89',
    fontSize: 12,
    fontWeight: '600',
  },
  envOptionTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  regionCardRow: {
    gap: 8,
    marginBottom: 16,
  },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D0B14',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  regionPillActive: {
    borderColor: 'rgba(254, 60, 114, 0.4)',
    backgroundColor: 'rgba(254, 60, 114, 0.05)',
  },
  regionPillText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
  },
  regionPillTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  advancedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 6,
  },
  advancedToggleText: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '700',
  },
  advancedDrawer: {
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    marginBottom: 16,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    color: '#8E8DA3',
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#161424',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.30)',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  modalLogoutBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },

  // ── Sign-out confirmation toast ──
  signedOutToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.32)',
  },
  signedOutToastText: {
    color: '#10B981',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Custom Logout Confirmation Modal ──
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
