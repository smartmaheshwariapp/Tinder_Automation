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
import { getAutoDetectedLocalIp, resolveLocalUrl } from '../utils/network';
import { startHyperbeamCloudSession } from '../utils/sessionManager';
import useExtensionStats from '../hooks/useExtensionStats';
import { DashboardPanel } from '../components/dashboard';
import SupabaseService from '../services/supabase';
import NotificationService from '../services/notifications';
import NotificationCenterModal from '../components/NotificationCenterModal';

const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const TINDER_IMG = require('../../assets/flirteasy/tinder.jpg');
const BUMBLE_IMG = require('../../assets/flirteasy/bumble.png');
const HINGE_IMG = require('../../assets/flirteasy/Hinge.png');

const PLATFORMS_LIST = [
  { id: 'Tinder', name: 'Tinder', icon: TINDER_IMG, color: '#FE3C72', status: 'Live 24/7' },
  { id: 'Bumble', name: 'Bumble', icon: BUMBLE_IMG, color: '#FBBF24', status: 'Ready' },
  { id: 'Hinge', name: 'Hinge', icon: HINGE_IMG, color: '#A78BFA', status: 'Beta' },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlatformSelectScreen({ navigation }) {
  const [selectedPlatform, setSelectedPlatform] = useState('Tinder');
  const [environment, setEnvironment] = useState('hyperbeam'); // 'hyperbeam' | 'vps' | 'local'
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

  // ── Login Detection State ──
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking, true, false
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Notification Center State ──
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    const unsub = NotificationService.subscribeInbox((items) => {
      setUnreadNotifCount(items.filter((i) => !i.is_read).length);
    });
    return unsub;
  }, []);

  // ── Animations ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bannerSlide = useRef(new Animated.Value(-80)).current;
  const modalSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    const detected = getAutoDetectedLocalIp();
    if (detected && detected !== 'localhost' && localUrl.includes('localhost')) {
      setLocalUrl(`http://${detected}:8080/?usr=User&pwd=admin`);
    }
  }, []);

  const activeStreamUrl = environment === 'hyperbeam'
    ? 'hyperbeam'
    : (environment === 'vps' ? vpsUrl : localUrl);

  const activeProxy = environment === 'vps'
    ? (userRegion === 'israel' ? 'http://*****:*****@46.203.181.164:43343' : '')
    : (environment === 'hyperbeam' ? '' : localProxy);

  const orchestratorUrl = environment === 'vps'
    ? 'https://api.smartmaheshwari.com'
    : resolveLocalUrl('http://localhost:3001');

  // Stats polling
  const { stats, loading, error, refresh: refreshStats } = useExtensionStats(orchestratorUrl, true);

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auth detection & login banner animation
  useEffect(() => {
    if (!stats) return;
    const isAuthed = Boolean(
      stats.tinderAccount?.isLoggedIn ||
      stats.tinderAccount?.name ||
      stats.tinderAccount?.email ||
      (stats.loginStep && stats.loginStep === 'done')
    );
    setIsLoggedIn(isAuthed);
    setCheckingAuth(false);

    if (!isAuthed) {
      Animated.spring(bannerSlide, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
  }, [stats, bannerSlide]);

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

  // Toggle remote agent
  const handleToggleAgent = useCallback(async () => {
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
  }, [orchestratorUrl, stats, refreshStats]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch(`${orchestratorUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setTimeout(refreshStats, 500);
      setTimeout(refreshStats, 1500);
    } catch (_) { }
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, [orchestratorUrl, refreshStats]);

  const confirmLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const handleOpenLiveFeed = useCallback(async (platformName) => {
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

    navigation.navigate('Browser', {
      vpsUrl: resolvedUrl,
      platform: targetPlatform,
      environment: environment,
      proxyIp: realProxy,
      orchestratorUrl,
    });
  }, [navigation, activeProxy, activeStreamUrl, environment, selectedPlatform, orchestratorUrl]);

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

          {/* Quick 1-Tap Launch Button */}
          <TouchableOpacity
            style={[styles.headerLaunchBtn, startingSession && { opacity: 0.8 }]}
            onPress={() => handleOpenLiveFeed(selectedPlatform)}
            disabled={startingSession}
            activeOpacity={0.85}
          >
            {startingSession ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="play" size={12} color="#FFF" />
                <Text style={styles.headerLaunchBtnText}>Launch</Text>
              </>
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

      {/* ═══════════════════ PLATFORM SWITCHER TABS ═══════════════════ */}
      <View style={styles.platformTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.platformTabsScroll}
        >
          {PLATFORMS_LIST.map((item) => {
            const isSelected = selectedPlatform === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.platformTabItem,
                  isSelected && styles.platformTabItemActive,
                  { borderColor: isSelected ? item.color : 'rgba(255, 255, 255, 0.08)', backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)' },
                ]}
                onPress={() => setSelectedPlatform(item.id)}
                activeOpacity={0.8}
              >
                <Image source={item.icon} style={styles.platformTabIcon} />
                <Text
                  style={[
                    styles.platformTabText,
                    isSelected && styles.platformTabTextActive,
                    isSelected && { color: '#FFF' },
                  ]}
                >
                  {item.name}
                </Text>
                {item.id === 'Tinder' && isLoggedIn ? (
                  <View style={styles.tabOnlineDot} />
                ) : (
                  <View
                    style={[
                      styles.platformTabBadge,
                      { backgroundColor: isSelected ? item.color + '26' : 'rgba(255, 255, 255, 0.06)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.platformTabBadgeText,
                        { color: isSelected ? item.color : '#8E8DA3' },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ═══════════════════ PLATFORM-SPECIFIC CONTENT ═══════════════════ */}
      {selectedPlatform === 'Tinder' ? (
        <>
          {/* ═══════════════════ QUICK LAUNCH ACTION BAR ═══════════════════ */}
          <View style={styles.quickLaunchContainer}>
            <TouchableOpacity
              style={[styles.quickLaunchPrimaryBtn, startingSession && { opacity: 0.8 }]}
              onPress={() => handleOpenLiveFeed('Tinder')}
              disabled={startingSession}
              activeOpacity={0.85}
            >
              {startingSession ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.quickLaunchPrimaryText}>Starting Cloud Browser...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="play" size={16} color="#FFF" />
                  <Text style={styles.quickLaunchPrimaryText}>Launch Tinder Session</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickLaunchSecondaryBtn}
              onPress={() => handleLaunch('Tinder')}
              activeOpacity={0.85}
            >
              <Ionicons name="options-outline" size={16} color="#FE3C72" />
              <Text style={styles.quickLaunchSecondaryText}>Configure</Text>
            </TouchableOpacity>
          </View>
          {/* ═══════════════════ LOGIN BANNER (contextual - logged out) ═══════════════════ */}
          {isLoggedIn === false && !checkingAuth && (
            <Animated.View style={[styles.loginBanner, { transform: [{ translateY: bannerSlide }] }]}>
              <View style={styles.loginBannerContent}>
                <Image source={TINDER_IMG} style={styles.loginBannerIcon} />
                <View style={styles.loginBannerTextWrap}>
                  <Text style={styles.loginBannerTitle}>Connect Tinder Account</Text>
                  <Text style={styles.loginBannerSub}>Log in once to activate full AI automation</Text>
                </View>
                <TouchableOpacity
                  style={styles.loginBannerBtn}
                  onPress={() => handleOpenLiveFeed('Tinder')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.loginBannerBtnText}>Connect</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFF" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* ═══════════════════ ACTIVE SESSION BANNER (contextual - logged in) ═══════════════════ */}
          {isLoggedIn === true && (
            <View style={styles.activeSessionBanner}>
              <View style={styles.activeSessionLeft}>
                <View style={styles.tinderLogoWrap}>
                  <Image source={TINDER_IMG} style={styles.activeSessionIcon} />
                  <View style={styles.activeDotBadge} />
                </View>
                <View style={styles.activeSessionTextWrap}>
                  <View style={styles.activeSessionTitleRow}>
                    <Text style={styles.activeSessionTitle}>Tinder Active</Text>
                    <View style={styles.livePulsePill}>
                      <View style={styles.livePulseDot} />
                      <Text style={styles.livePulseText}>ONLINE</Text>
                    </View>
                  </View>
                  <Text style={styles.activeSessionSub} numberOfLines={1}>
                    {stats?.tinderAccount?.name || stats?.tinderAccount?.email || 'Live Automation Active'}
                  </Text>
                </View>
              </View>

              <View style={styles.activeSessionActions}>
                <TouchableOpacity
                  style={styles.activeStreamBtn}
                  onPress={() => handleOpenLiveFeed('Tinder')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="videocam" size={13} color="#FFF" />
                  <Text style={styles.activeStreamBtnText}>Stream</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.activeLogoutBtn}
                  onPress={confirmLogout}
                  activeOpacity={0.85}
                >
                  <Ionicons name="log-out-outline" size={14} color="#EF4444" />
                  <Text style={styles.activeLogoutBtnText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══════════════════ MAIN DASHBOARD BODY ═══════════════════ */}
          <Animated.View style={[styles.dashboardWrap, { opacity: fadeAnim }]}>
            <DashboardPanel
              stats={stats}
              loading={loading}
              error={error}
              orchestratorUrl={orchestratorUrl}
              onToggleAgent={handleToggleAgent}
              onLogout={handleLogout}
              controlsContent={
                <View style={styles.infoBox}>
                  <View style={styles.infoTitleRow}>
                    <Ionicons name="sparkles" size={16} color="#FE3C72" />
                    <Text style={styles.infoTitle}>
                      {isLoggedIn ? 'Tinder Assistant Ready' : 'Getting Started'}
                    </Text>
                  </View>
                  <Text style={styles.infoText}>
                    {isLoggedIn
                      ? 'Your assistant finds compatible matches and engages in your personal tone 24/7.'
                      : 'Link your Tinder profile to start finding matches and chatting automatically.'}
                  </Text>

                  <View style={styles.sessionControlColumn}>
                    <TouchableOpacity
                      style={styles.openStreamBtn}
                      onPress={() => handleOpenLiveFeed('Tinder')}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="phone-portrait-outline" size={15} color="#FFF" />
                      <Text style={styles.openStreamBtnText}>View Live Tinder Stream</Text>
                    </TouchableOpacity>

                    {isLoggedIn && (
                      <TouchableOpacity
                        style={styles.mainLogoutBtn}
                        onPress={confirmLogout}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="log-out-outline" size={15} color="#EF4444" />
                        <Text style={styles.mainLogoutBtnText}>Log Out of Tinder</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              }
            />
          </Animated.View>
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.platformHubCard, { borderColor: selectedPlatform === 'Bumble' ? 'rgba(251, 191, 36, 0.35)' : 'rgba(167, 139, 250, 0.35)' }]}>
            <View style={styles.platformHubHeader}>
              <Image
                source={selectedPlatform === 'Bumble' ? BUMBLE_IMG : HINGE_IMG}
                style={styles.platformHubIcon}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.platformHubTitle}>{selectedPlatform} Assistant</Text>
                  <View style={[styles.platformHubPill, { backgroundColor: selectedPlatform === 'Bumble' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(167, 139, 250, 0.15)' }]}>
                    <Text style={[styles.platformHubPillText, { color: selectedPlatform === 'Bumble' ? '#FBBF24' : '#A78BFA' }]}>
                      {selectedPlatform === 'Bumble' ? 'READY' : 'BETA'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.platformHubSubtitle}>
                  {selectedPlatform === 'Bumble'
                    ? 'Automate Bumble matching and first-move replies with AI tone matching.'
                    : 'Intelligent prompt replies, voice analyzer, and compatibility swiping.'}
                </Text>
              </View>
            </View>

            <View style={styles.platformFeatureList}>
              <View style={styles.platformFeatureItem}>
                <Ionicons name="sparkles" size={16} color={selectedPlatform === 'Bumble' ? '#FBBF24' : '#A78BFA'} />
                <Text style={styles.platformFeatureText}>
                  {selectedPlatform === 'Bumble' ? 'Smart First-Move Auto-Responder' : 'Contextual Bio & Prompt Answers'}
                </Text>
              </View>
              <View style={styles.platformFeatureItem}>
                <Ionicons name="flame" size={16} color={selectedPlatform === 'Bumble' ? '#FBBF24' : '#A78BFA'} />
                <Text style={styles.platformFeatureText}>
                  {selectedPlatform === 'Bumble' ? 'High-Compatibility Profile Filter' : 'Standout Likes & Profile Boost'}
                </Text>
              </View>
              <View style={styles.platformFeatureItem}>
                <Ionicons name="shield-checkmark" size={16} color={selectedPlatform === 'Bumble' ? '#FBBF24' : '#A78BFA'} />
                <Text style={styles.platformFeatureText}>
                  {selectedPlatform === 'Bumble' ? 'Human-like Swiping & Delay Emulation' : 'Anti-Detection & Safe Pacing'}
                </Text>
              </View>
            </View>

            <View style={styles.platformActionBtnRow}>
              <TouchableOpacity
                style={[styles.platformPrimaryBtn, { backgroundColor: selectedPlatform === 'Bumble' ? '#F59E0B' : '#7C3AED' }]}
                onPress={() => handleOpenLiveFeed(selectedPlatform)}
                activeOpacity={0.85}
              >
                <Ionicons name="videocam" size={16} color="#FFF" />
                <Text style={styles.platformPrimaryBtnText}>Launch {selectedPlatform} Live Session</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.platformSecondaryBtn}
                onPress={() => handleLaunch(selectedPlatform)}
                activeOpacity={0.85}
              >
                <Ionicons name="options-outline" size={16} color="#D8D6E8" />
                <Text style={styles.platformSecondaryBtnText}>Configure {selectedPlatform} AI Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ═══════════════════ CONNECTION SETTINGS MODAL ═══════════════════ */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
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
                  <Text style={styles.modalTitle}>Connection Settings</Text>
                  <TouchableOpacity onPress={closeModal} activeOpacity={0.8}>
                    <Ionicons name="close-circle" size={22} color="#716E89" />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* ─── Environment & Routing Settings ─── */}
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Routing & Environment</Text>
                      <TouchableOpacity onPress={() => setShowAdvanced(!showAdvanced)}>
                        <Text style={styles.advancedToggle}>
                          {showAdvanced ? 'Hide Config' : 'Configure Ports'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.envSelector}>
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
                        ⚡ Hyperbeam Cloud
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
                        VPS Server
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
                        Local Neko
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Region Selector (VPS only) */}
                  {environment === 'vps' && (
                    <>
                      <Text style={styles.modalSectionLabel}>Location Route</Text>
                      <View style={styles.regionCardRow}>
                        <TouchableOpacity
                          style={[styles.regionPill, userRegion === 'israel' && styles.regionPillActive]}
                          onPress={() => setUserRegion('israel')}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={userRegion === 'israel' ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={userRegion === 'israel' ? '#FE3C72' : '#716E89'}
                          />
                          <Text style={[styles.regionPillText, userRegion === 'israel' && styles.regionPillTextActive]}>
                            Israel Proxy (Tel Aviv)
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.regionPill, userRegion === 'direct' && styles.regionPillActive]}
                          onPress={() => setUserRegion('direct')}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={userRegion === 'direct' ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={userRegion === 'direct' ? '#FE3C72' : '#716E89'}
                          />
                          <Text style={[styles.regionPillText, userRegion === 'direct' && styles.regionPillTextActive]}>
                            Direct Connection
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Advanced Toggle */}
                  <TouchableOpacity
                    style={styles.advancedToggleRow}
                    onPress={() => setShowAdvanced(!showAdvanced)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.advancedToggleText}>
                      {showAdvanced ? 'Hide Advanced Config' : 'Configure Custom Ports & URLs'}
                    </Text>
                    <Ionicons
                      name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color="#FE3C72"
                    />
                  </TouchableOpacity>

                  {showAdvanced && (
                    <View style={styles.advancedDrawer}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Stream Server URL</Text>
                        <TextInput
                          style={styles.textInput}
                          value={environment === 'vps' ? vpsUrl : localUrl}
                          onChangeText={environment === 'vps' ? setVpsUrl : setLocalUrl}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholderTextColor="#55526B"
                        />
                      </View>

                      <View style={[styles.inputGroup, { marginTop: 10 }]}>
                        <Text style={styles.inputLabel}>Proxy Endpoint (Optional)</Text>
                        <TextInput
                          style={styles.textInput}
                          value={environment === 'vps' ? vpsProxy : localProxy}
                          onChangeText={environment === 'vps' ? setVpsProxy : setLocalProxy}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholderTextColor="#55526B"
                          placeholder="socks5://user:pass@host:port"
                        />
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
        </Pressable>
      </Modal>

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

  // ── Platform Switcher Tabs ──
  platformTabsContainer: {
    backgroundColor: '#12101C',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  platformTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  platformTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  platformTabItemActive: {
    backgroundColor: '#1E1B2E',
  },
  platformTabIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  platformTabText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '700',
  },
  platformTabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  platformTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  platformTabBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tabOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },

  // ── Non-Tinder Platform Hub Card ──
  platformHubCard: {
    backgroundColor: '#14121F',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  platformHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  platformHubIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  platformHubTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  platformHubPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  platformHubPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  platformHubSubtitle: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 17,
  },
  platformFeatureList: {
    marginVertical: 14,
    gap: 10,
  },
  platformFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  platformFeatureText: {
    color: '#D8D6E8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  platformActionBtnRow: {
    gap: 10,
    marginTop: 12,
  },
  platformPrimaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  platformPrimaryBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  platformSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  platformSecondaryBtnText: {
    color: '#D8D6E8',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Login Banner (Logged Out) ──
  loginBanner: {
    backgroundColor: '#161324',
    borderBottomWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  loginBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loginBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  loginBannerTextWrap: {
    flex: 1,
  },
  loginBannerTitle: {
    color: '#F59E0B',
    fontSize: 12.5,
    fontWeight: '800',
  },
  loginBannerSub: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  loginBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FE3C72',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  loginBannerBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Active Session Banner (Logged In - Above the Fold) ──
  activeSessionBanner: {
    backgroundColor: '#151322',
    borderBottomWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeSessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tinderLogoWrap: {
    position: 'relative',
  },
  activeSessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  activeDotBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#151322',
  },
  activeSessionTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  activeSessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeSessionTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  livePulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  livePulseDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  livePulseText: {
    color: '#10B981',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeSessionSub: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1.5,
  },
  activeSessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FE3C72',
    paddingHorizontal: 10,
    paddingVertical: 6.5,
    borderRadius: 8,
  },
  activeStreamBtnText: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  activeLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.30)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeLogoutBtnText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: '700',
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
  sessionControlColumn: {
    gap: 8,
    marginTop: 14,
  },
  openStreamBtn: {
    backgroundColor: '#FE3C72',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  openStreamBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  mainLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mainLogoutBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Connection Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
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
