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
import useExtensionStats from '../hooks/useExtensionStats';
import { DashboardPanel } from '../components/dashboard';

const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const TINDER_IMG = require('../../assets/flirteasy/tinder.jpg');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlatformSelectScreen({ navigation }) {
  // ── Connection Configuration State ──
  const [environment, setEnvironment] = useState('vps'); // 'vps' | 'local'
  const [userRegion, setUserRegion] = useState('israel'); // 'israel' | 'direct'
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  // ── Computed URLs ──
  const activeStreamUrl = environment === 'vps' ? vpsUrl : localUrl;
  const activeProxy = environment === 'vps'
    ? (userRegion === 'israel' ? 'http://*****:*****@46.203.181.164:43343' : '')
    : localProxy;

  const orchestratorUrl = environment === 'vps'
    ? 'https://api.smartmaheshwari.com'
    : resolveLocalUrl('http://localhost:3001');

  // ── Live Stats Polling ──
  const { stats, loading, error, refresh: refreshStats } = useExtensionStats(orchestratorUrl, true);

  // ── Login Detection ──
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${orchestratorUrl}/check-page-state`);
        const data = await res.json();
        if (isMounted) {
          setIsLoggedIn(data?.state === 'logged_in');
          setCheckingAuth(false);
        }
      } catch (err) {
        try {
          const sRes = await fetch(`${orchestratorUrl}/extension-stats`);
          const sData = await sRes.json();
          if (isMounted) {
            const hasActivity = Boolean(
              sData?.lifetimeStats?.totalSwipes > 0 ||
              sData?.agentState?.isRunning ||
              sData?.settings?.userProfile?.name
            );
            setIsLoggedIn(hasActivity);
            setCheckingAuth(false);
          }
        } catch (_) {
          if (isMounted) {
            setIsLoggedIn(false);
            setCheckingAuth(false);
          }
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orchestratorUrl]);

  // ── Mount Fade-In Animation ──
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Login Banner Spring Animation ──
  useEffect(() => {
    if (isLoggedIn === false && !checkingAuth) {
      Animated.spring(bannerSlide, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(bannerSlide, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoggedIn, checkingAuth]);

  // ── Modal Animations ──
  const openModal = useCallback(() => {
    setShowSettingsModal(true);
    Animated.spring(modalSlide, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, []);

  const closeModal = useCallback(() => {
    Animated.timing(modalSlide, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setShowSettingsModal(false));
  }, []);

  // ── Agent Toggle ──
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
      setTimeout(refreshStats, 300);
      setTimeout(refreshStats, 1200);
    } catch (_) {}
  }, [orchestratorUrl, stats, refreshStats]);

  // ── Logout Handler ──
  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch(`${orchestratorUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'tinder' }),
      });
      setIsLoggedIn(false);
      setTimeout(refreshStats, 500);
      setTimeout(refreshStats, 1500);
    } catch (_) {}
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  }, [orchestratorUrl, refreshStats]);

  const confirmLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);
  
  const handleOpenLiveFeed = useCallback(() => {
    const realProxy = activeProxy === 'http://*****:*****@46.203.181.164:43343'
      ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
      : activeProxy;

    navigation.navigate('Browser', {
      platform: 'Tinder',
      vpsUrl: resolveLocalUrl(activeStreamUrl),
      proxyIp: realProxy,
    });
  }, [navigation, activeStreamUrl, activeProxy]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09080E" />

      {/* ═══════════════════ HEADER BAR ═══════════════════ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={LOGO_IMG} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.headerTitle}>FlirtEasy</Text>
            <Text style={styles.headerSub}>AI Dating Assistant</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Connection Settings Gear */}
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={openModal}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={18} color="#8E8DA3" />
          </TouchableOpacity>
        </View>
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
              onPress={handleOpenLiveFeed}
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
              onPress={handleOpenLiveFeed}
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
                  onPress={handleOpenLiveFeed}
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
              <Pressable onPress={() => {}} /* prevent overlay dismiss */>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Connection & Server</Text>
                  <TouchableOpacity onPress={closeModal} activeOpacity={0.8}>
                    <Ionicons name="close-circle" size={22} color="#716E89" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalBody}
                >
                  {/* Environment Toggle */}
                  <Text style={styles.modalSectionLabel}>Server Environment</Text>
                  <View style={styles.envSelector}>
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
                        Cloud VPS
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
                        Local Machine
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Region Selector (VPS only) */}
                  {environment === 'vps' && (
                    <>
                      <Text style={styles.modalSectionLabel}>Proxy Routing</Text>
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
