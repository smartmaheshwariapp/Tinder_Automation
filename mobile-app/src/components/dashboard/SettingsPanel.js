// src/components/dashboard/SettingsPanel.js — Exact 1:1 FlirtEasy V2 Settings Architecture
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import ActivityIndicator from '../common/SafeActivityIndicator';
import AppConfirmModal from '../common/AppConfirmModal';
import {
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Image,
  Animated,
  Easing,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveLocalUrl } from '../../utils/network';
import TinderProfileCard from './TinderProfileCard';
import { theme as uiTheme } from '../../theme';
import { FocusInput } from '../common/Motion';
import IconButton from '../ui/IconButton';
import IconWell from '../ui/IconWell';
import SectionHeader from '../ui/SectionHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TINDER_ICON = require('../../../assets/flirteasy/tinder.jpg');

const SWIPE_PRESETS = [0, 10, 50, 100, 150];
const MSG_PRESETS = [0, 10, 50, 100, 150];

import { REGION_FILTERS, CITY_PRESETS } from '../../utils/locationHubs';
import LocationService from '../../services/locationService';
import LocationNoticeModal from '../common/LocationNoticeModal';
import { getRateLimitStatus, subscribeRateLimit, resetRateLimits } from '../../utils/rateLimiter';
import { saveOnDeviceSessionState } from '../../utils/sessionManager';
// ─── Feature Flags (Hidden in On-Device mode for clean UX, preserved for future cloud mode) ───
const SHOW_LOCATION_FEATURE = false;

const BIO_MODES = [
  { id: 'tinder', label: 'Sync' },
  { id: 'manual', label: 'Custom' },
  { id: 'ai', label: 'Generate' },
];

import {
  generateBioWithAI,
  generateSmartBioFallback,
  CURATED_MAGIC_BIOS,
} from '../../services/bioGeneratorService';

const MAGIC_BIOS = CURATED_MAGIC_BIOS;
const generateSmartBio = generateSmartBioFallback;

// Profile preview fields schema matching live Tinder profile
const PROFILE_FIELDS = [
  { key: 'name', label: 'Name', icon: 'person-outline', default: 'Not specified on Tinder' },
  { key: 'age', label: 'Age', icon: 'calendar-outline', default: 'Not specified on Tinder' },
  { key: 'bio', label: 'Bio Context', icon: 'document-text-outline', default: 'Not specified on Tinder' },
  { key: 'interests', label: 'Passions & Interests', icon: 'sparkles-outline', default: 'Not specified on Tinder' },
  { key: 'job', label: 'Profession', icon: 'briefcase-outline', default: 'Not specified on Tinder' },
  { key: 'school', label: 'Education', icon: 'school-outline', default: 'Not specified on Tinder' },
  { key: 'height', label: 'Height', icon: 'resize-outline', default: 'Not specified on Tinder' },
  { key: 'lookingFor', label: 'Looking For', icon: 'heart-outline', default: 'Not specified on Tinder' },
  { key: 'relationshipType', label: 'Relationship Type', icon: 'infinite-outline', default: 'Not specified on Tinder' },
  { key: 'languages', label: 'Languages', icon: 'globe-outline', default: 'Not specified on Tinder' },
  { key: 'zodiac', label: 'Zodiac', icon: 'planet-outline', default: 'Not specified on Tinder' },
  { key: 'city', label: 'City', icon: 'location-outline', default: 'Not specified on Tinder' },
  { key: 'gender', label: 'Gender', icon: 'transgender-outline', default: 'Not specified on Tinder' },
  { key: 'drinking', label: 'Drinking', icon: 'wine-outline', default: 'Not specified on Tinder' },
  { key: 'smoking', label: 'Smoking', icon: 'cloud-outline', default: 'Not specified on Tinder' },
  { key: 'workout', label: 'Workout', icon: 'fitness-outline', default: 'Not specified on Tinder' },
  { key: 'pets', label: 'Pets', icon: 'paw-outline', default: 'Not specified on Tinder' },
  { key: 'communicationStyle', label: 'Communication Style', icon: 'chatbubbles-outline', default: 'Not specified on Tinder' },
  { key: 'loveStyle', label: 'Love Style', icon: 'heart-circle-outline', default: 'Not specified on Tinder' },
  { key: 'socialMedia', label: 'Social Presence', icon: 'share-social-outline', default: 'Not specified on Tinder' },
];

export default function SettingsPanel({
  settings,
  loading,
  saving,
  saveSuccess,
  error,
  onSave,
  onDirtyChange,
  onLogout,
  onConnect,
  isLoggedIn: propIsLoggedIn,
  rawControlsContent,
  orchestratorUrl,
  stats,
  onSyncProfile,
  onPushBio,
  initialOpenSection,
}) {
  const [tinderAuth, setTinderAuth] = useState(() => {
    try {
      return typeof getTinderAuthState === 'function' ? getTinderAuthState() : null;
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    if (typeof subscribeTinderAuthState === 'function') {
      return subscribeTinderAuthState((newAuth) => {
        setTinderAuth({ ...newAuth });
      });
    }
  }, []);

  const isTinderLoggedIn = Boolean(
    propIsLoggedIn !== undefined
      ? propIsLoggedIn
      : (stats?.tinderAccount?.isLoggedIn ?? tinderAuth?.isLoggedIn ?? false)
  );

  const handleConnectPress = () => {
    if (typeof onConnect === 'function') {
      onConnect();
    } else if (typeof onLogout === 'function') {
      onLogout();
    }
  };

  const [form, setForm] = useState(null);
  const formRef = useRef(null);
  const [safetyCollapsed, setSafetyCollapsed] = useState(true);
  const [locationCollapsed, setLocationCollapsed] = useState(true);

  useEffect(() => {
    if (initialOpenSection === 'location') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLocationCollapsed(false);
    }
  }, [initialOpenSection]);

  const [showCustomCoords, setShowCustomCoords] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [fetchingGps, setFetchingGps] = useState(false);
  const [locationNoticeModal, setLocationNoticeModal] = useState(null);

  const filteredPresets = useMemo(() => {
    let list = CITY_PRESETS;
    if (selectedRegion === 'Popular') {
      list = list.filter(p => p.popular);
    } else if (selectedRegion !== 'All') {
      list = list.filter(p => p.region === selectedRegion);
    }
    if (citySearchQuery.trim()) {
      const q = citySearchQuery.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.short.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.lang.toLowerCase().includes(q) ||
        p.langCode.toLowerCase() === q
      );
    }
    return list;
  }, [selectedRegion, citySearchQuery]);

  const popularPresets = useMemo(() => {
    return CITY_PRESETS.filter(p => p.popular).slice(0, 8);
  }, []);
  const [bioMode, setBioMode] = useState('tinder');
  const [bioCollapsed, setBioCollapsed] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Bio Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState('not synced yet');
  const [previewVisible, setPreviewVisible] = useState(false);

  const isSafetyOn = form ? form.safetyMode !== false : true;
  const [rateLimitStatus, setRateLimitStatus] = useState({
    likes: { used: 0, limit: 50, remaining: 50 },
    messages: { used: 0, limit: 50, remaining: 50 },
    isSafetyLocked: false,
  });

  useEffect(() => {
    let mounted = true;
    try {
      const status = getRateLimitStatus(isSafetyOn);
      if (mounted && status) setRateLimitStatus(status);
    } catch (_) {}

    const unsub = subscribeRateLimit((status) => {
      if (mounted && status) setRateLimitStatus(status);
    });
    return () => {
      mounted = false;
      if (typeof unsub === 'function') unsub();
    };
  }, [isSafetyOn]);

  // Magic Bio Generator state (0: idle, 1: loading, 2: result, 3: pushed)
  const [genStep, setGenStep] = useState(0);
  const [generatedBioData, setGeneratedBioData] = useState(MAGIC_BIOS[0]);
  const [pushing, setPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [pushError, setPushError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Raw keypad drawer
  const [showRawControls, setShowRawControls] = useState(false);

  // Desktop V2 Animated Save Bar & Change Tracking Controller
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveBarVisible, setSaveBarVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const saveBarAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const saveBarTimer = useRef(null);

  const showSaveBar = useCallback(() => {
    setSaveBarVisible(true);
    setHasUnsavedChanges(true);

    if (saveBarTimer.current) clearTimeout(saveBarTimer.current);
    progressAnim.setValue(1);

    Animated.spring(saveBarAnim, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    saveBarTimer.current = setTimeout(() => {
      Animated.timing(saveBarAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setSaveBarVisible(false);
      });
    }, 5000);
  }, [saveBarAnim, progressAnim]);

  const hideSaveBar = useCallback(() => {
    if (saveBarTimer.current) clearTimeout(saveBarTimer.current);
    Animated.timing(saveBarAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSaveBarVisible(false);
    });
  }, [saveBarAnim]);

  const hasInitializedBioMode = useRef(false);

  useEffect(() => {
    if (settings) {
      const cloned = JSON.parse(JSON.stringify(settings));
      setForm(cloned);
      formRef.current = cloned;
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      if (!hasInitializedBioMode.current && settings.aboutSource) {
        setBioMode(settings.aboutSource);
        hasInitializedBioMode.current = true;
      }
      if (settings.userProfile) {
        setLastSyncTime('just now');
      }
    }
  }, [settings, hideSaveBar, onDirtyChange]);

  useEffect(() => {
    if (saveSuccess) {
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      setToastMessage('Settings saved successfully!');
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setToastMessage(null);
    }
  }, [saveSuccess, hideSaveBar, onDirtyChange]);

  const handleDiscard = useCallback(() => {
    if (settings) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const cloned = JSON.parse(JSON.stringify(settings));
      setForm(cloned);
      formRef.current = cloned;
      setHasUnsavedChanges(false);
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      setToastMessage('Changes discarded');
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [settings, hideSaveBar, onDirtyChange]);

  const handleSavePress = useCallback((overrideForm) => {
    const targetForm = overrideForm || formRef.current || form;
    if (onSave && targetForm) {
      onSave({
        ...targetForm,
        aboutSource: bioMode,
      });
    }
  }, [onSave, form, bioMode]);

  const updateField = (path, value) => {
    let nextState = null;
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      nextState = next;
      formRef.current = next;
      return next;
    });
    showSaveBar();
    if (onDirtyChange) {
      onDirtyChange(true, () => handleSavePress(nextState), handleDiscard);
    }
  };

  const handleLocationAcquired = useCallback((res) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    let nextState = null;
    setForm(prev => {
      const next = {
        ...prev,
        useDeviceLocation: true,
        locationCity: res.cityName,
        locationLatitude: res.latitude,
        locationLongitude: res.longitude,
      };
      nextState = next;
      formRef.current = next;
      return next;
    });
    showSaveBar();
    if (onDirtyChange) {
      onDirtyChange(true, () => handleSavePress(nextState), handleDiscard);
    }
  }, [handleSavePress, onDirtyChange]);

  const handleChooseCityManually = useCallback(() => {
    setLocationNoticeModal(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocationCollapsed(false);
    updateField('useDeviceLocation', false);
  }, []);

  const handleToggleDeviceLocation = async (enable) => {
    if (!enable) {
      updateField('useDeviceLocation', false);
      return;
    }

    if (fetchingGps) return;
    setFetchingGps(true);
    try {
      const result = await LocationService.requestAndGetDeviceLocation();
      if (result.success) {
        handleLocationAcquired(result);
        setLocationNoticeModal({
          visible: true,
          type: 'connected',
          title: 'Location Connected',
          cityName: result.cityName,
          message: `Your dating location is now set to ${result.cityName}. Tinder will show you matches in this area.`,
        });
      } else if (result.code === 'SERVICES_DISABLED') {
        updateField('useDeviceLocation', false);
        setLocationNoticeModal({
          visible: true,
          type: 'services_disabled',
          title: 'Location Turned Off',
          message: result.error || "Your phone's location service is turned off. Please turn on Location in quick settings to see nearby people.",
        });
      } else if (result.code === 'PERMISSION_BLOCKED' || result.canAskAgain === false) {
        updateField('useDeviceLocation', false);
        setLocationNoticeModal({
          visible: true,
          type: 'access_needed',
          title: 'Location Access Needed',
          message: result.error || "To discover and match with singles in your city, please allow Location in your phone's settings.",
        });
      } else {
        updateField('useDeviceLocation', false);
        setLocationNoticeModal({
          visible: true,
          type: 'access_needed',
          title: 'Location Access Needed',
          message: result.error || 'Please enable location permissions in your phone settings to match with singles nearby.',
        });
      }
    } catch (err) {
      updateField('useDeviceLocation', false);
      setLocationNoticeModal({
        visible: true,
        type: 'notice',
        title: 'Location Notice',
        message: 'Unable to detect your current location. Please pick a city or check permissions.',
      });
    } finally {
      setFetchingGps(false);
    }
  };

  const handleSelectCity = useCallback((preset) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    let nextState = null;
    setForm(prev => {
      const next = {
        ...prev,
        useDeviceLocation: false,
        locationCity: preset.name,
        locationLatitude: preset.latitude,
        locationLongitude: preset.longitude,
      };
      nextState = next;
      formRef.current = next;
      return next;
    });
    showSaveBar();
    if (onDirtyChange) {
      onDirtyChange(true, () => handleSavePress(nextState), handleDiscard);
    }
  }, [showSaveBar, onDirtyChange, handleSavePress, handleDiscard]);

  // ── Logout Handler with Custom Glass Modal ──
  const handleLogoutPress = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = async () => {
    setLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else if (orchestratorUrl) {
        await fetch(`${orchestratorUrl}/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'tinder' }),
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  // ── Real Live Sync Now handler via onDevice bridge or CDP ──
  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);

    let syncedProfile = null;

    // 1. Try On-Device WebView bridge if provided by parent (BrowserScreen)
    if (typeof onSyncProfile === 'function') {
      try {
        const onDeviceRes = await onSyncProfile();
        if (onDeviceRes && onDeviceRes.success && onDeviceRes.profile) {
          syncedProfile = onDeviceRes.profile;
        } else if (onDeviceRes?.error && !orchestratorUrl) {
          setSyncError(onDeviceRes.error);
        }
      } catch (err) {
        console.warn('[SettingsPanel] onSyncProfile error:', err);
      }
    }

    // 2. Fallback to Orchestrator CDP bridge (/sync-profile and /extension-settings)
    const effectiveOrchUrl = orchestratorUrl || resolveLocalUrl('http://localhost:3001');
    if (!syncedProfile && effectiveOrchUrl) {
      try {
        // First try live sync route
        const res = await fetch(`${effectiveOrchUrl}/sync-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'tinder' }),
        });
        const data = await res.json();
        if (data && data.success && data.profile && (data.profile.name || (data.profile.bio && data.profile.bio.length > 2) || (data.profile.interests && data.profile.interests.length > 0))) {
          syncedProfile = data.profile;
        } else {
          // Fallback to checking cached settings in the orchestrator
          const settingsRes = await fetch(`${effectiveOrchUrl}/extension-settings`);
          const settingsData = await settingsRes.json();
          if (settingsData?.success && settingsData?.settings?.userProfile && (settingsData.settings.userProfile.name || settingsData.settings.userProfile.bio)) {
            syncedProfile = settingsData.settings.userProfile;
          } else if (data?.error) {
            setSyncError(data.error);
          }
        }
      } catch (e) {
        if (!syncError) {
          setSyncError('Could not connect to Tinder session. Please make sure Tinder is open and logged in.');
        }
      }
    }

    if (syncedProfile) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      let nextState = null;
      setForm(prev => {
        const next = { ...prev, userProfile: syncedProfile };
        if (syncedProfile.bio && (!prev?.manualBio || prev?.aboutSource === 'tinder')) {
          next.manualBio = syncedProfile.bio;
        }
        nextState = next;
        formRef.current = next;
        return next;
      });
      setSyncSuccess(true);
      setSyncError(null);
      setLastSyncTime('just now');
      showSaveBar();
      if (onDirtyChange) {
        onDirtyChange(true, () => handleSavePress(nextState), handleDiscard);
      }
      setTimeout(() => setSyncSuccess(false), 4000);
    } else {
      if (!syncError) {
        setSyncError('Could not sync profile. Please log in to Tinder in the browser session first.');
      }
    }

    setSyncing(false);
  };

  // ── Magic Bio Generator Actions (AI-Powered & Local Fallback) ──
  const handleRunGenerate = async () => {
    setGenStep(1);
    try {
      const generated = await generateBioWithAI({
        userProfile: form?.userProfile,
        apiKey: form?.apiKey,
        currentBioText: generatedBioData?.text,
        orchestratorUrl,
      });
      setGeneratedBioData(generated);
      updateField('manualBio', generated.text);
      setGenStep(2);
    } catch (err) {
      const fallback = generateSmartBioFallback(form?.userProfile, generatedBioData?.text);
      setGeneratedBioData(fallback);
      updateField('manualBio', fallback.text);
      setGenStep(2);
    }
  };

  // ── Real Live Push Bio handler (On-Device WebView Bridge + Orchestrator) ──
  const handlePushBio = async (specificBio) => {
    setPushing(true);
    setPushError(null);
    const bioText = (typeof specificBio === 'string' && specificBio) ? specificBio : (generatedBioData?.text || form?.manualBio);

    if (!bioText) {
      setPushError('No bio text to push.');
      setPushing(false);
      return;
    }

    const applyPushSuccess = () => {
      const activeMode = bioMode || 'ai';
      setForm(prev => {
        const next = { ...prev, manualBio: bioText, aboutSource: activeMode };
        formRef.current = next;
        return next;
      });
      if (onSave) {
        onSave({ ...(formRef.current || form), manualBio: bioText, aboutSource: activeMode });
      }
      hideSaveBar();
      if (onDirtyChange) onDirtyChange(false, null, null);
      setPushSuccess(true);
      setPushing(false);
      setTimeout(() => setPushSuccess(false), 3500);
    };

    // 1. First priority: On-Device WebView bridge if provided (BrowserScreen)
    if (onPushBio) {
      try {
        const res = await onPushBio(bioText);
        if (res && res.success) {
          applyPushSuccess();
          return;
        } else {
          setPushError(res?.error || 'Failed to push bio to Tinder.');
          setPushing(false);
          return;
        }
      } catch (err) {
        setPushError(err.message || 'On-device push bio failed.');
        setPushing(false);
        return;
      }
    }

    // 2. Second priority: Backend orchestrator POST /push-bio
    const effectiveOrchUrl = orchestratorUrl || resolveLocalUrl('http://localhost:3001');
    if (effectiveOrchUrl) {
      try {
        const res = await fetch(`${effectiveOrchUrl}/push-bio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'tinder', bio: bioText }),
        });
        const data = await res.json();
        if (data && data.success) {
          applyPushSuccess();
          return;
        } else {
          setPushError(data?.error || 'Push failed. Please ensure your Tinder session is logged in.');
          setPushing(false);
          return;
        }
      } catch (e) {
        setPushError(e.message || 'Push request failed. Please ensure you are logged into Tinder.');
        setPushing(false);
        return;
      }
    }

    setPushError('Tinder session is not connected. Please log in to Tinder first.');
    setPushing(false);
  };

  const handleCopyBio = (text) => {
    const textToCopy = (typeof text === 'string' && text) ? text : (generatedBioData?.text || form?.manualBio || '');
    if (textToCopy) {
      Clipboard.setString(textToCopy);
    }
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading || !form) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="small" color={uiTheme.colors.accent} />
        <Text style={styles.loadingText} accessibilityRole="progressbar" accessibilityLabel="Syncing Linksy Settings">Syncing Linksy Settings...</Text>
      </View>
    );
  }

  // In Safety Mode ON, V2 enforces exact defaults: 50 swipes, 50 msgs
  const activeSwipes = isSafetyOn ? 50 : (form.likesPerCycle ?? 50);
  const activeMsgs = isSafetyOn ? 50 : (form.messagesPerCycle ?? 50);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ════════════════════ CATEGORY 1: SAFETY ════════════════════ */}
        <SectionHeader title="SAFETY" description="Hourly limits that keep your account looking natural." style={[styles.sectionHeader, styles.sectionHeaderFirst]} />

        <View style={styles.card}>
          {/* Section Header with Independent Safety Toggle & Chevron */}
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel="Safety Mode details"
              accessibilityState={{ expanded: !safetyCollapsed }}
              style={styles.headerLeftTouchable}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSafetyCollapsed(!safetyCollapsed);
              }}
              activeOpacity={0.7}
            >
              <IconWell icon="shield-checkmark-outline" tone={isSafetyOn ? 'success' : 'warning'} size={36} />
              <Text style={styles.cardTitle} numberOfLines={1}>Safety Mode</Text>
              <Ionicons
                name={safetyCollapsed ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={uiTheme.colors.muted}
                style={styles.headerChevron}
              />
            </TouchableOpacity>

            <Switch
              accessibilityLabel="Safety Mode"
              value={isSafetyOn}
              onValueChange={v => {
                updateField('safetyMode', v);
              }}
              trackColor={{ false: uiTheme.colors.elevatedHigh, true: uiTheme.colors.primary }}
              thumbColor={uiTheme.colors.white}
              ios_backgroundColor={uiTheme.colors.elevatedHigh}
            />
          </View>

          {/* Collapsible Inner Content (Hidden when collapsed) */}
          {!safetyCollapsed && (
            <View style={styles.cardBody}>
              {/* 2 Independent Meter Boxes (Likes/hr: used/limit, Msgs/hr: used/limit) */}
              <View style={styles.metersRow}>
                <View style={styles.meterBox}>
                  <Text style={styles.meterLabel} numberOfLines={1}>Likes/hr</Text>
                  <Text
                    style={[
                      styles.meterValue,
                      !isSafetyOn && styles.meterValueDanger,
                    ]}
                  >
                    {isSafetyOn ? `${rateLimitStatus.likes?.used ?? 0}/${rateLimitStatus.likes?.limit ?? 50}` : 'No limit'}
                  </Text>
                </View>

                <View style={styles.meterBox}>
                  <Text style={styles.meterLabel} numberOfLines={1}>Msgs/hr</Text>
                  <Text
                    style={[
                      styles.meterValue,
                      !isSafetyOn && styles.meterValueDanger,
                    ]}
                  >
                    {isSafetyOn ? `${rateLimitStatus.messages?.used ?? 0}/${rateLimitStatus.messages?.limit ?? 50}` : 'No limit'}
                  </Text>
                </View>
              </View>

              {/* Badges Row (Auto-managed · Shadowban secure) */}
              <View style={styles.safetyFeaturesRow}>
                <View style={[styles.safetyFeatureChip, isSafetyOn ? styles.safetyFeatureChipOn : styles.safetyFeatureChipOff]}>
                  <Ionicons
                    name={isSafetyOn ? "checkmark" : "close"}
                    size={13}
                    color={isSafetyOn ? uiTheme.colors.success : uiTheme.colors.error}
                  />
                  <Text
                    style={[
                      styles.safetyFeatureText,
                      { color: isSafetyOn ? uiTheme.colors.success : uiTheme.colors.error },
                    ]}
                  >
                    {isSafetyOn ? "Auto-managed" : "Manual overrides"}
                  </Text>
                </View>

                <View style={[styles.safetyFeatureChip, isSafetyOn ? styles.safetyFeatureChipOn : styles.safetyFeatureChipOff]}>
                  <Ionicons
                    name={isSafetyOn ? "checkmark" : "warning"}
                    size={13}
                    color={isSafetyOn ? uiTheme.colors.success : uiTheme.colors.error}
                  />
                  <Text
                    style={[
                      styles.safetyFeatureText,
                      { color: isSafetyOn ? uiTheme.colors.success : uiTheme.colors.error },
                    ]}
                  >
                    {isSafetyOn ? "Shadowban secure" : "Shadowban risk"}
                  </Text>
                </View>
              </View>

              {/* Safety Lock Active Banner with manual reset override */}
              {Boolean(rateLimitStatus?.isSafetyLocked) && (
                <View style={styles.lockBanner} accessibilityRole="alert">
                  <Ionicons name="time-outline" size={20} color={uiTheme.colors.warning} style={styles.lockBannerIcon} />
                  <View style={styles.lockBannerCopy}>
                    <Text style={styles.lockBannerTitle}>
                      Safety Lock Active ({rateLimitStatus.resetIn || 59}m remaining)
                    </Text>
                    <Text style={styles.lockBannerText}>
                      Hourly limit reached. Tap Reset to resume swiping now.
                    </Text>
                  </View>
                  <TouchableOpacity accessibilityRole="button"
                    accessibilityLabel="Reset safety limits"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.lockResetBtn}
                    onPress={async () => {
                      await resetRateLimits();
                      await saveOnDeviceSessionState({ waitingReason: null, nextRunTimestamp: null });
                      Alert.alert('Safety Limits Reset', 'Hourly safety rate limits have been cleared. You can resume swiping.');
                    }}
                  >
                    <Text style={styles.lockResetText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Speed & Batch Preset Controls (Locked with 55% opacity when Safety ON) */}
              <View
                style={[
                  styles.presetSection,
                  isSafetyOn && styles.presetSectionLocked,
                ]}
              >
                {/* Swipes Preset Row */}
                <View style={styles.presetRow}>
                  <Text style={styles.presetLabel}>Swipes per cycle</Text>
                  <View style={styles.presetButtonGroup} accessibilityRole="radiogroup" accessibilityLabel="Swipes per cycle">
                    {SWIPE_PRESETS.map(val => (
                      <TouchableOpacity accessibilityRole="button"
                        key={val}
                        accessibilityLabel={`${val} swipes per cycle`}
                        accessibilityState={{ selected: activeSwipes === val, disabled: isSafetyOn }}
                        disabled={isSafetyOn}
                        style={[
                          styles.presetBtn,
                          activeSwipes === val && styles.presetBtnActive,
                        ]}
                        onPress={() => updateField('likesPerCycle', val)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.presetBtnText,
                            activeSwipes === val && styles.presetBtnTextActive,
                          ]}
                        >
                          {val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Messages Preset Row */}
                <View style={styles.presetRow}>
                  <Text style={styles.presetLabel}>Messages per cycle</Text>
                  <View style={styles.presetButtonGroup} accessibilityRole="radiogroup" accessibilityLabel="Messages per cycle">
                    {MSG_PRESETS.map(val => (
                      <TouchableOpacity accessibilityRole="button"
                        key={val}
                        accessibilityLabel={`${val} messages per cycle`}
                        accessibilityState={{ selected: activeMsgs === val, disabled: isSafetyOn }}
                        disabled={isSafetyOn}
                        style={[
                          styles.presetBtn,
                          activeMsgs === val && styles.presetBtnActive,
                        ]}
                        onPress={() => updateField('messagesPerCycle', val)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.presetBtnText,
                            activeMsgs === val && styles.presetBtnTextActive,
                          ]}
                        >
                          {val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {isSafetyOn && (
                  <View style={styles.lockedNoteRow}>
                    <Ionicons name="lock-closed" size={14} color={uiTheme.colors.info} style={styles.lockedNoteIcon} />
                    <Text style={styles.lockedNoteText}>
                      Presets locked to safe defaults. Toggle Safety Mode OFF above to customize.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CATEGORY: MATCHING LOCATION ════════════════════ */}
        {SHOW_LOCATION_FEATURE && (
          <>
            <Text style={styles.categoryLabel}>MATCHING LOCATION</Text>

            <View style={styles.card}>
              <TouchableOpacity accessibilityRole="button"
                style={styles.cardHeaderRow}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setLocationCollapsed(!locationCollapsed);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.locationHeaderLeft}>
                  <View style={styles.locationIconWrap}>
                    <Ionicons name="navigate-circle" size={18} color={uiTheme.colors.primary} />
                  </View>
                  <Text style={styles.cardTitle}>Matching Location</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.locationActiveBadge, form?.useDeviceLocation && styles.locationActiveBadgeLive]}>
                    <View style={[styles.locationActiveDot, form?.useDeviceLocation && styles.locationActiveDotLive]} />
                    <Text style={[styles.locationActiveText, form?.useDeviceLocation && styles.locationActiveTextLive]} numberOfLines={1}>
                      {form?.useDeviceLocation ? 'Current Location' : (form?.locationCity || 'New York, NY')}
                    </Text>
                  </View>
                  <Ionicons
                    name={locationCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={uiTheme.colors.muted}
                  />
                </View>
              </TouchableOpacity>

              {!locationCollapsed && (
                <View style={{ marginTop: 10 }}>
                  {/* Segmented Mode Selector: Live Near Me | Pick a City */}
                  <View style={styles.segmentedSelector}>
                    <TouchableOpacity accessibilityRole="button"
                      style={[
                        styles.segBtn,
                        form?.useDeviceLocation && styles.segBtnActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        if (!form?.useDeviceLocation) {
                          handleToggleDeviceLocation(true);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons
                          name="navigate"
                          size={13}
                          color={form?.useDeviceLocation ? uiTheme.colors.success : uiTheme.colors.muted}
                        />
                        <Text
                          style={[
                            styles.segBtnText,
                            form?.useDeviceLocation && { fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.onPrimary, fontWeight: 'normal' },
                          ]}
                        >
                          Live Near Me
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity accessibilityRole="button"
                      style={[
                        styles.segBtn,
                        !form?.useDeviceLocation && styles.segBtnActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        if (form?.useDeviceLocation) {
                          updateField('useDeviceLocation', false);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons
                          name="globe-outline"
                          size={13}
                          color={!form?.useDeviceLocation ? uiTheme.colors.primary : uiTheme.colors.muted}
                        />
                        <Text
                          style={[
                            styles.segBtnText,
                            !form?.useDeviceLocation && { fontFamily: uiTheme.fonts.strong, color: uiTheme.colors.onPrimary, fontWeight: 'normal' },
                          ]}
                        >
                          Pick a City
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* ─── Mode 1: Live Near Me (Phone GPS) ─── */}
                  {form?.useDeviceLocation ? (
                    <View style={{ marginTop: 10 }}>
                      <View style={styles.liveGpsCard}>
                        <View style={styles.liveGpsTopRow}>
                          <View style={{ flex: 1, paddingRight: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={styles.liveGpsDot} />
                              <Text style={styles.liveGpsCity} numberOfLines={1}>
                                {form?.locationCity || 'Current Location'}
                              </Text>
                            </View>
                            <Text style={styles.liveGpsSub}>
                              {fetchingGps
                                ? 'Detecting live phone GPS…'
                                : 'Live Phone GPS Connected • Matching nearby'}
                            </Text>
                          </View>

                          <TouchableOpacity accessibilityRole="button"
                            style={styles.refreshGpsBtn}
                            onPress={() => handleToggleDeviceLocation(true)}
                            disabled={fetchingGps}
                            activeOpacity={0.8}
                          >
                            {fetchingGps ? (
                              <ActivityIndicator size="small" color={uiTheme.colors.success} />
                            ) : (
                              <>
                                <Ionicons name="refresh" size={13} color={uiTheme.colors.success} />
                                <Text style={styles.refreshGpsBtnText}>Update</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* ─── Mode 2: Pick a City (Passport) ─── */
                    <View style={{ marginTop: 10 }}>
                      {/* Current Selected City Banner */}
                      <View style={styles.selectedCityBanner}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          {CITY_PRESETS.find(p => (form?.locationCity || '').includes(p.short))?.flag ? (
                            <Text style={{ fontFamily: uiTheme.fonts.body, fontSize: 22 }}>
                              {CITY_PRESETS.find(p => (form?.locationCity || '').includes(p.short)).flag}
                            </Text>
                          ) : (
                            <View style={styles.selectedCityIconWrap}>
                              <Ionicons name="globe-outline" size={20} color={uiTheme.colors.primary} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.selectedCityTitle} numberOfLines={1}>
                              {form?.locationCity || 'New York, USA'}
                            </Text>
                            <Text style={styles.selectedCitySub}>Active Dating Location</Text>
                          </View>
                        </View>
                        <View style={styles.passportActivePill}>
                          <Text style={styles.passportActiveText}>PASSPORT</Text>
                        </View>
                      </View>

                      {/* Quick Popular Destinations Chips */}
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.quickLabel}>POPULAR DESTINATIONS</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.quickChipsScroll}
                        >
                          {popularPresets.map(preset => {
                            const isSelected = (form?.locationCity || '').includes(preset.short) ||
                              (Math.abs((form?.locationLatitude || 0) - preset.latitude) < 0.05 &&
                               Math.abs((form?.locationLongitude || 0) - preset.longitude) < 0.05);
                            return (
                              <TouchableOpacity accessibilityRole="button"
                                key={preset.id}
                                style={[styles.quickChip, isSelected && styles.quickChipActive]}
                                onPress={() => handleSelectCity(preset)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.quickChipFlag}>{preset.flag}</Text>
                                <Text style={[styles.quickChipText, isSelected && styles.quickChipTextActive]}>
                                  {preset.short}
                                </Text>
                                {isSelected && (
                                  <Ionicons name="checkmark-circle" size={12} color={uiTheme.colors.primary} style={{ marginLeft: 2 }} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>

                      {/* Search Bar for Cities */}
                      <View style={styles.hubSearchWrap}>
                        <Ionicons name="search-outline" size={15} color={uiTheme.colors.muted} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.hubSearchInput}
                          placeholder="Search city or country (e.g. London, Tokyo, Miami)..."
                          placeholderTextColor={uiTheme.colors.muted}
                          value={citySearchQuery}
                          onChangeText={setCitySearchQuery}
                          autoCapitalize="none"
                        />
                        {citySearchQuery.length > 0 && (
                          <TouchableOpacity accessibilityRole="button"
                            onPress={() => setCitySearchQuery('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={16} color={uiTheme.colors.muted} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Region Filter Tabs */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.regionFilterScroll}
                        contentContainerStyle={styles.regionFilterContainer}
                      >
                        {REGION_FILTERS.map(region => (
                          <TouchableOpacity accessibilityRole="button"
                            key={region}
                            style={[styles.regionTab, selectedRegion === region && styles.regionTabActive]}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setSelectedRegion(region);
                            }}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.regionTabText, selectedRegion === region && styles.regionTabTextActive]}>
                              {region}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Height-Constrained Scrollable City List */}
                      <ScrollView
                        style={styles.cityListScroll}
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                        contentContainerStyle={styles.hubGrid}
                      >
                        {filteredPresets.map((preset) => {
                          const isActive = (form?.locationCity || '').includes(preset.short) ||
                            (Math.abs((form?.locationLatitude || 0) - preset.latitude) < 0.05 &&
                             Math.abs((form?.locationLongitude || 0) - preset.longitude) < 0.05);
                          return (
                            <TouchableOpacity accessibilityRole="button"
                              key={preset.id}
                              style={[styles.hubCard, isActive && styles.hubCardActive]}
                              onPress={() => handleSelectCity(preset)}
                              activeOpacity={0.75}
                            >
                              <View style={styles.hubCardTop}>
                                <Text style={styles.hubCardFlag}>{preset.flag}</Text>
                                {isActive ? (
                                  <Ionicons name="checkmark-circle" size={15} color={uiTheme.colors.primary} />
                                ) : (
                                  <Text style={styles.hubCountryCode}>{preset.langCode.toUpperCase()}</Text>
                                )}
                              </View>
                              <Text style={[styles.hubCardCity, isActive && styles.hubCardCityActive]} numberOfLines={1}>
                                {preset.short}
                              </Text>
                              <Text style={styles.hubCardCountry} numberOfLines={1}>
                                {preset.country}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {filteredPresets.length === 0 && (
                        <View style={styles.noHubsFoundWrap}>
                          <Ionicons name="search-outline" size={22} color={uiTheme.colors.muted} />
                          <Text style={styles.noHubsFoundText}>No cities matching "{citySearchQuery}"</Text>
                          <TouchableOpacity accessibilityRole="button" onPress={() => setCitySearchQuery('')} style={{ marginTop: 4 }}>
                            <Text style={styles.resetFilterText}>Clear search</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Custom Location Accordion Toggle */}
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.customAccordionToggle}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setShowCustomCoords(!showCustomCoords);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons
                            name={showCustomCoords ? "chevron-up" : "add-circle-outline"}
                            size={14}
                            color={uiTheme.colors.muted}
                          />
                          <Text style={styles.customAccordionText}>
                            {showCustomCoords ? "Hide custom place" : "Can't find your city? Set a custom place"}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Custom Location Card (Collapsible) */}
                      {showCustomCoords && (
                        <View style={styles.customCoordsCard}>
                          <View>
                            <Text style={styles.customInputLabel}>City or Region Name</Text>
                            <TextInput
                              style={styles.customTextInput}
                              value={form?.locationCity || ''}
                              onChangeText={(v) => {
                                updateField('locationCity', v);
                                updateField('useDeviceLocation', false);
                              }}
                              placeholder="e.g. Austin, TX or Berlin, Germany"
                              placeholderTextColor={uiTheme.colors.muted}
                            />
                          </View>

                          <View style={styles.customInputRow}>
                            <View style={styles.customInputHalf}>
                              <Text style={styles.customInputLabel}>Latitude (Optional)</Text>
                              <TextInput
                                style={styles.customTextInput}
                                value={form?.locationLatitude !== undefined ? String(form.locationLatitude) : '40.7128'}
                                onChangeText={(v) => updateField('locationLatitude', parseFloat(v) || 0)}
                                keyboardType="numeric"
                                placeholder="40.7128"
                                placeholderTextColor={uiTheme.colors.muted}
                              />
                            </View>
                            <View style={styles.customInputHalf}>
                              <Text style={styles.customInputLabel}>Longitude (Optional)</Text>
                              <TextInput
                                style={styles.customTextInput}
                                value={form?.locationLongitude !== undefined ? String(form.locationLongitude) : '-74.0060'}
                                onChangeText={(v) => updateField('locationLongitude', parseFloat(v) || 0)}
                                keyboardType="numeric"
                                placeholder="-74.0060"
                                placeholderTextColor={uiTheme.colors.muted}
                              />
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Information Footnote */}
                  <View style={styles.locationNoteRow}>
                    <Ionicons name="sparkles" size={13} color={uiTheme.colors.primary} />
                    <Text style={styles.locationNoteText}>
                      Linksy synchronizes your dating location automatically so you can meet people anywhere.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* ════════════════════ CATEGORY 2: AI PROFILE ════════════════════ */}
        <SectionHeader title="AI PROFILE" description="What the AI knows about you when it writes." style={styles.sectionHeader} />

        <View style={styles.card}>
          {/* Card Title Row with Chevron */}
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel="Your Bio (Improve it with AI)"
            accessibilityState={{ expanded: !bioCollapsed }}
            style={styles.cardHeaderRow}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setBioCollapsed(!bioCollapsed);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeaderLeft}>
              <IconWell icon="document-text-outline" tone="primary" size={36} />
              <Text style={styles.cardTitle} numberOfLines={2}>Your Bio (Improve it with AI)</Text>
            </View>
            <Ionicons
              name={bioCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Segmented Mode Selector: Sync | Custom | Generate */}
          <View style={styles.segmentedSelector} accessibilityRole="tablist">
            {BIO_MODES.map(bm => (
              <TouchableOpacity accessibilityRole="tab"
                key={bm.id}
                accessibilityLabel={bm.label}
                accessibilityState={{ selected: bioMode === bm.id }}
                style={[
                  styles.segBtn,
                  bioMode === bm.id && styles.segBtnActive,
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setBioMode(bm.id);
                  if (bioCollapsed) setBioCollapsed(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segBtnText,
                    bioMode === bm.id && styles.segBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {bm.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Collapsible Details Drawer */}
          {!bioCollapsed && (
            <View style={styles.bioDrawer}>

              {/* ── Panel 1: Sync with Live Dating Profile ── */}
              {bioMode === 'tinder' && (
                <View style={styles.bioSubPanel}>
                  <Text style={styles.bioPanelHint}>
                    Uses your live dating profile.
                  </Text>

                  <View style={styles.syncRow}>
                    <TouchableOpacity accessibilityRole="button"
                      accessibilityLabel={syncSuccess ? 'Synced' : 'Sync Now'}
                      accessibilityState={{ disabled: !!syncing, busy: !!syncing }}
                      style={styles.syncBtn}
                      onPress={handleSyncNow}
                      disabled={syncing}
                      activeOpacity={0.85}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color={uiTheme.colors.onPrimary} />
                      ) : (
                        <Text style={styles.syncBtnText} numberOfLines={1}>
                          {syncSuccess ? '✓ Synced' : 'Sync Now'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity accessibilityRole="button"
                      style={styles.previewEyeBtn}
                      onPress={() => setPreviewVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="eye-outline" size={16} color={uiTheme.colors.accent} />
                      <Text style={styles.previewEyeBtnText} numberOfLines={1}>How AI Sees You</Text>
                    </TouchableOpacity>
                  </View>

                  {syncError ? (
                    <View style={styles.syncErrorCard}>
                      <Ionicons name="alert-circle" size={16} color={uiTheme.colors.error} />
                      <Text style={styles.syncErrorText}>{syncError}</Text>
                    </View>
                  ) : (
                    <View style={styles.syncStatusCard}>
                      <View style={styles.syncStatusDot} />
                      <Text style={styles.syncStatusText}>
                        Synced from Tinder · {lastSyncTime}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Panel 2: Custom Bio ── */}
              {bioMode === 'manual' && (
                <View style={styles.bioSubPanel}>
                  <FocusInput
                    style={styles.bioTextArea}
                    multiline={true}
                    placeholder="Enter your text here"
                    accessibilityLabel="Custom bio"
                    value={form.manualBio || ''}
                    onChangeText={v => updateField('manualBio', v)}
                  />
                  <View style={styles.customBioFooter}>
                    <Text style={styles.bioPanelHint}>
                      AI only uses this description
                    </Text>
                    <Text style={styles.charCountText}>
                      {(form.manualBio || '').length} chars
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Panel 3: Magic Bio Studio (Step 0 - 3) ── */}
              {bioMode === 'ai' && (
                <View style={styles.bioSubPanel}>
                  {genStep === 0 && (
                    <View style={styles.genStepWrap}>
                      <IconWell icon="sparkles" tone="primary" size={52} style={styles.magicIconWrap} />
                      <Text style={styles.magicTitle}>Generate a Magic Bio</Text>
                      <Text style={styles.magicDesc}>
                        Let AI analyze your profile and craft the perfect bio to maximize your matches.
                      </Text>
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.magicCtaBtn}
                        onPress={handleRunGenerate}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="sparkles" size={16} color={uiTheme.colors.onPrimary} />
                        <Text style={styles.magicCtaBtnText}>Generate Bio Now</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {genStep === 1 && (
                    <View style={styles.genLoadingWrap}>
                      <ActivityIndicator size="small" color={uiTheme.colors.accent} />
                      <Text style={styles.genLoadingText}>
                        ✨ AI is crafting your personalized bio...
                      </Text>
                    </View>
                  )}

                  {genStep === 2 && (
                    <View style={styles.genResultWrap}>
                      {/* Quality Score Ring */}
                      <View style={styles.scoreRow}>
                        <View style={styles.scoreRing}>
                          <Text style={styles.scoreNumber}>
                            {generatedBioData.score}
                          </Text>
                        </View>
                        <View style={styles.scoreCopy}>
                          <View style={styles.scoreTitleRow}>
                            <Text style={styles.scoreLabel}>Quality Score</Text>
                            <View style={styles.activeScoreTag}>
                              <Text style={styles.activeScoreTagText}>Active</Text>
                            </View>
                          </View>
                          <Text style={styles.scoreSub}>
                            Your bio is highly engaging. Push it now.
                          </Text>
                        </View>
                      </View>

                      {/* Bio Output Box */}
                      <View style={styles.bioBoxResult}>
                        <Text style={styles.bioResultText}>
                          {generatedBioData.text}
                        </Text>
                      </View>

                      {pushError && (
                        <View style={styles.syncErrorCard}>
                          <Ionicons name="alert-circle" size={16} color={uiTheme.colors.error} />
                          <Text style={styles.syncErrorText}>{pushError}</Text>
                        </View>
                      )}

                      {/* Action Buttons */}
                      <View style={styles.genActionsRow}>
                        <TouchableOpacity accessibilityRole="button"
                          style={styles.genActionSecBtn}
                          onPress={handleRunGenerate}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.genActionSecText}>↺ Regen</Text>
                        </TouchableOpacity>

                        <TouchableOpacity accessibilityRole="button"
                          style={[
                            styles.genActionPushBtn,
                            pushSuccess && styles.genActionPushBtnSuccess,
                          ]}
                          onPress={handlePushBio}
                          disabled={pushing}
                          accessibilityState={{ disabled: !!pushing, busy: !!pushing }}
                          activeOpacity={0.85}
                        >
                          {pushing ? (
                            <ActivityIndicator size="small" color={uiTheme.colors.onPrimary} />
                          ) : (
                            <View style={styles.genActionPushInner}>
                              {pushSuccess && (
                                <Ionicons name="checkmark-circle" size={16} color={uiTheme.colors.onPrimary} />
                              )}
                              <Text style={styles.genActionPushText}>
                                {pushSuccess ? '✓ Pushed to Tinder' : '↓ Push Bio to Tinder'}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity accessibilityRole="button"
                          style={styles.genActionSecBtn}
                          onPress={handleCopyBio}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.genActionSecText,
                              copySuccess && { color: uiTheme.colors.success },
                            ]}
                          >
                            {copySuccess ? '✓ Copied' : 'Copy'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ════════════════════ CATEGORY 3: ACCOUNT ════════════════════ */}
        <SectionHeader title="ACCOUNT & SESSION" description="Your connected Tinder account." style={styles.sectionHeader} />

        <View style={styles.card}>
          <View style={styles.accountProfileRow}>
            <View style={styles.accountIconWrap}>
              <Image source={TINDER_ICON} style={styles.accountLogo} />
              <View
                style={[
                  styles.accountActiveDot,
                  !isTinderLoggedIn && styles.accountInactiveDot,
                ]}
              />
            </View>
            <View style={styles.accountInfoWrap}>
              <View style={styles.accountTitleRow}>
                <Text style={styles.accountTitle} numberOfLines={1}>
                  {isTinderLoggedIn
                    ? (form?.userProfile?.name
                      ? `${form.userProfile.name} (Tinder)`
                      : (stats?.tinderAccount?.name || tinderAuth?.accountName || 'Tinder Account'))
                    : 'Tinder Account'}
                </Text>
                <View
                  style={[
                    styles.accountPlanBadge,
                    !isTinderLoggedIn && styles.accountInactiveBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.accountPlanText,
                      !isTinderLoggedIn && styles.accountInactiveBadgeText,
                    ]}
                    numberOfLines={1}
                  >
                    {isTinderLoggedIn ? 'PRO PLAN ✦' : 'NOT CONNECTED'}
                  </Text>
                </View>
              </View>
              <Text style={styles.accountSubText} numberOfLines={1}>
                {isTinderLoggedIn
                  ? (stats?.tinderAccount?.email ? `${stats.tinderAccount.email} • Connected` : 'Active • Connected Session')
                  : 'Signed Out • Connect Tinder to automate'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Dynamic Action Button: Logout if Connected, Connect if Disconnected */}
          {isTinderLoggedIn ? (
            <TouchableOpacity accessibilityRole="button"
              style={styles.accountLogoutBtn}
              onPress={handleLogoutPress}
              disabled={loggingOut}
              accessibilityLabel="Log Out of Tinder"
              accessibilityState={{ disabled: !!loggingOut, busy: !!loggingOut }}
              activeOpacity={0.85}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={uiTheme.colors.error} />
              ) : (
                <View style={styles.accountLogoutBtnInner}>
                  <Ionicons name="log-out-outline" size={18} color={uiTheme.colors.error} />
                  <Text style={styles.accountLogoutBtnText}>Log Out of Tinder</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity accessibilityRole="button"
              style={styles.accountConnectBtn}
              onPress={handleConnectPress}
              activeOpacity={0.85}
            >
              <View style={styles.accountConnectBtnInner}>
                <Ionicons name="flame" size={18} color={uiTheme.colors.onPrimary} />
                <Text style={styles.accountConnectBtnText}>Log In to Tinder</Text>
                <Ionicons name="arrow-forward" size={16} color={uiTheme.colors.onPrimary} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ════════════════════ CATEGORY 4: DIRECT KEYPAD ════════════════════ */}
        {rawControlsContent && (
          <>
            <SectionHeader title="VIRTUAL CONTAINER CONTROLS" description="Manual OTP and keypad input." style={styles.sectionHeader} />
            <View style={styles.card}>
              <TouchableOpacity accessibilityRole="button"
                accessibilityLabel="Direct OTP & Keypad"
                accessibilityState={{ expanded: !!showRawControls }}
                style={styles.cardHeaderRow}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowRawControls(!showRawControls);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeaderLeft}>
                  <IconWell icon="keypad-outline" tone="info" size={36} />
                  <Text style={styles.cardTitle} numberOfLines={1}>Direct OTP & Keypad</Text>
                </View>
                <Ionicons
                  name={showRawControls ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={uiTheme.colors.muted}
                />
              </TouchableOpacity>

              {showRawControls && (
                <View style={styles.rawControlsBody}>
                  {rawControlsContent}
                </View>
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* ─── Modal: How AI Sees You (Profile Inspection Sheet) ─── */}
      <Modal
        visible={previewVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet} accessibilityViewIsModal>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle} accessibilityRole="header" numberOfLines={1}>How AI Sees You</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>YOUR SYNCED PROFILE CONTEXT</Text>
              </View>
              <IconButton
                icon="close"
                size={40}
                iconSize={20}
                style={styles.modalCloseBtn}
                onPress={() => setPreviewVisible(false)}
                accessibilityLabel="Close"
              />
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <TinderProfileCard
                profile={form?.userProfile}
                settings={form}
                stats={stats}
                isLoggedIn={Boolean(form?.userProfile?.name || form?.userProfile?.bio)}
                syncing={syncing}
                onSync={handleSyncNow}
                compact
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Logout confirmation (shared branded dialog) ─── */}
      <AppConfirmModal
        visible={showLogoutConfirm}
        icon="log-out-outline"
        iconColor={uiTheme.colors.accent}
        iconBg={uiTheme.colors.primarySoft}
        iconBorder={uiTheme.colors.primaryBorder}
        title="Log out of Tinder?"
        message="This ends the active Tinder session and pauses your AI assistant until you sign back in."
        detail={{ title: settings?.userProfile?.name || "Your Tinder account", subtitle: "Tinder session on this device", icon: "flame" }}
        confirmText="Log out"
        cancelText="Cancel"
        confirmVariant="primary"
        busy={!!loggingOut}
        onConfirm={executeLogout}
        onCancel={() => !loggingOut && setShowLogoutConfirm(false)}
      />

      {/* ─── Universal Synced Location Notice Modal ─── */}
      {SHOW_LOCATION_FEATURE && (
      <LocationNoticeModal
        visible={Boolean(locationNoticeModal?.visible)}
        type={locationNoticeModal?.type || 'connected'}
        title={locationNoticeModal?.title}
        cityName={locationNoticeModal?.cityName}
        message={locationNoticeModal?.message}
        onClose={() => setLocationNoticeModal(null)}
        onChooseCityManually={handleChooseCityManually}
        onLocationAcquired={handleLocationAcquired}
      />
      )}
    </View>
  );
}

const c = uiTheme.colors;
const sp = uiTheme.spacing;
const r = uiTheme.radius;
const ty = uiTheme.type;
const L = uiTheme.layout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.xl,
    backgroundColor: c.background,
  },
  loadingText: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.md,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.xxs,
    paddingTop: 0,
    paddingBottom: sp.section,
  },
  categoryLabel: {
    ...ty.overline,
    color: c.muted,
    marginTop: sp.xxl,
    marginBottom: sp.sm,
    marginLeft: sp.xs,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    marginTop: sp.xxl,
  },
  sectionHeaderFirst: {
    marginTop: sp.xs,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: r.card,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: sp.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    minHeight: 48,
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  headerLeftTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    flex: 1,
    minWidth: 0,
    minHeight: L.touchTarget,
    paddingVertical: sp.xs,
  },
  headerChevron: {
    marginLeft: -sp.xs,
  },
  cardTitle: {
    ...ty.headline,
    color: c.text,
    flexShrink: 1,
  },
  cardBody: {
    marginTop: sp.md,
  },

  // ── 2 Independent Side-by-Side Meter Boxes ──
  metersRow: {
    flexDirection: 'row',
    gap: sp.sm,
    marginTop: sp.xs,
  },
  meterBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sp.xs,
    minHeight: 48,
    backgroundColor: c.elevated,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  meterLabel: {
    ...ty.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  meterValue: {
    ...ty.headline,
    fontFamily: uiTheme.fonts.strong,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  meterValueDanger: {
    color: c.error,
  },

  // ── Badges Row ──
  safetyFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: sp.md,
  },
  safetyFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    paddingHorizontal: sp.md - 2,
    paddingVertical: sp.xs,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.neutralBorder,
    backgroundColor: c.neutralSoft,
  },
  safetyFeatureChipOn: {
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
  },
  safetyFeatureChipOff: {
    backgroundColor: c.errorSoft,
    borderColor: c.errorBorder,
  },
  safetyFeatureText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
  },

  // ── Safety lock warning ──
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    marginTop: sp.md,
    padding: sp.md,
    backgroundColor: c.warningSoft,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.warningBorder,
  },
  lockBannerIcon: {
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  lockBannerCopy: {
    flex: 1,
    minWidth: 0,
  },
  lockBannerTitle: {
    ...ty.label,
    color: c.warning,
  },
  lockBannerText: {
    ...ty.footnote,
    color: c.textSecondary,
    marginTop: sp.xxs,
  },
  lockResetBtn: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: c.warning,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: r.sm,
  },
  lockResetText: {
    ...ty.buttonSmall,
    color: c.background,
  },

  // ── Presets ──
  presetSection: {
    marginTop: sp.lg,
    paddingTop: sp.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.divider,
    gap: sp.lg,
  },
  presetSectionLocked: {
    opacity: 0.55,
  },
  presetRow: {
    gap: sp.sm,
  },
  presetLabel: {
    ...ty.label,
    color: c.textSecondary,
  },
  presetButtonGroup: {
    flexDirection: 'row',
    backgroundColor: c.background,
    borderRadius: r.md,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: c.border,
  },
  presetBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingVertical: sp.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.sm,
  },
  presetBtnActive: {
    backgroundColor: c.primary,
    ...uiTheme.shadows.sm,
  },
  presetBtnText: {
    ...ty.subhead,
    color: c.muted,
    fontVariant: ['tabular-nums'],
  },
  presetBtnTextActive: {
    fontFamily: uiTheme.fonts.strong,
    color: c.onPrimary,
  },
  lockedNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    padding: sp.md,
    backgroundColor: c.infoSoft,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.infoBorder,
  },
  lockedNoteIcon: {
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  lockedNoteText: {
    ...ty.footnote,
    color: c.textSecondary,
    flex: 1,
    minWidth: 0,
  },

  // ── Segmented Mode Selector ──
  segmentedSelector: {
    flexDirection: 'row',
    backgroundColor: c.background,
    borderRadius: r.md,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: sp.md,
  },
  segBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.sm,
  },
  segBtnActive: {
    backgroundColor: c.primary,
    ...uiTheme.shadows.sm,
  },
  segBtnText: {
    ...ty.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  segBtnTextActive: {
    fontFamily: uiTheme.fonts.label,
    color: c.onPrimary,
  },
  bioDrawer: {
    marginTop: sp.xs,
  },
  bioSubPanel: {
    marginTop: sp.md,
  },
  bioPanelHint: {
    ...ty.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: sp.md,
    marginBottom: sp.md,
  },
  syncBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: L.touchTarget,
    backgroundColor: c.primary,
    borderRadius: r.button,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    ...ty.buttonSmall,
    color: c.onPrimary,
  },
  previewEyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs + 2,
    flexShrink: 1,
    minHeight: L.touchTarget,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    borderRadius: r.button,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
  },
  previewEyeBtnText: {
    ...ty.buttonSmall,
    color: c.accent,
    flexShrink: 1,
  },
  syncStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    backgroundColor: c.elevated,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm + 2,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  syncErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    backgroundColor: c.errorSoft,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm + 2,
    borderWidth: 1,
    borderColor: c.errorBorder,
  },
  syncErrorText: {
    ...ty.footnote,
    color: c.error,
    flex: 1,
    minWidth: 0,
  },
  syncStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.success,
  },
  syncStatusText: {
    ...ty.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  bioTextArea: {
    ...ty.callout,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    padding: sp.md,
    minHeight: 104,
    textAlignVertical: 'top',
  },
  customBioFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sp.md,
    marginTop: sp.sm,
  },
  charCountText: {
    ...ty.footnote,
    color: c.muted,
    fontVariant: ['tabular-nums'],
  },

  // ── Magic Bio Studio ──
  genStepWrap: {
    alignItems: 'center',
    paddingVertical: sp.md,
  },
  magicIconWrap: {
    marginBottom: sp.md,
  },
  magicTitle: {
    ...ty.section,
    color: c.text,
    textAlign: 'center',
    marginBottom: sp.xs,
  },
  magicDesc: {
    ...ty.callout,
    color: c.muted,
    textAlign: 'center',
    paddingHorizontal: sp.md,
    marginBottom: sp.lg,
  },
  magicCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    minHeight: 48,
    backgroundColor: c.primary,
    borderRadius: r.button,
    paddingVertical: sp.md,
    paddingHorizontal: sp.xxl,
    ...uiTheme.shadows.glow,
  },
  magicCtaBtnText: {
    ...ty.button,
    color: c.onPrimary,
  },
  genLoadingWrap: {
    paddingVertical: sp.xxl,
    alignItems: 'center',
    gap: sp.md,
  },
  genLoadingText: {
    ...ty.footnote,
    color: c.muted,
    textAlign: 'center',
  },
  genResultWrap: {
    gap: sp.md,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  scoreRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    ...ty.headline,
    fontFamily: uiTheme.fonts.strong,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  scoreCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: sp.md,
  },
  scoreTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: sp.sm,
  },
  scoreLabel: {
    ...ty.label,
    color: c.text,
  },
  activeScoreTag: {
    backgroundColor: c.successSoft,
    borderWidth: 1,
    borderColor: c.successBorder,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs,
    borderRadius: r.pill,
  },
  activeScoreTagText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.success,
  },
  scoreSub: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.xxs,
  },
  bioBoxResult: {
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    padding: sp.lg,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  bioResultText: {
    ...ty.body,
    color: c.text,
  },
  genActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: sp.sm,
  },
  genActionSecBtn: {
    minHeight: L.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: r.button,
  },
  genActionSecText: {
    ...ty.buttonSmall,
    color: c.text,
  },
  genActionPushBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: L.touchTarget,
    backgroundColor: c.primary,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.button,
  },
  genActionPushBtnSuccess: {
    backgroundColor: c.success,
  },
  genActionPushInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.xs,
  },
  genActionPushText: {
    ...ty.buttonSmall,
    color: c.onPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },

  // ── Account & Platforms ──
  accountProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  accountIconWrap: {
    position: 'relative',
  },
  accountLogo: {
    width: 48,
    height: 48,
    borderRadius: r.md,
  },
  accountActiveDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.success,
    borderWidth: 2,
    borderColor: c.surface,
  },
  accountInactiveDot: {
    backgroundColor: c.textTertiary,
    borderColor: c.surface,
  },
  accountInfoWrap: {
    flex: 1,
    minWidth: 0,
  },
  accountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: sp.sm,
    rowGap: sp.xs,
    marginBottom: sp.xxs,
  },
  accountTitle: {
    ...ty.headline,
    color: c.text,
    flexShrink: 1,
  },
  accountPlanBadge: {
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    borderRadius: r.pill,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs,
  },
  accountInactiveBadge: {
    backgroundColor: c.neutralSoft,
    borderColor: c.neutralBorder,
  },
  accountPlanText: {
    ...ty.overline,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    color: c.accent,
  },
  accountInactiveBadgeText: {
    color: c.textSecondary,
  },
  accountSubText: {
    ...ty.footnote,
    color: c.muted,
  },
  accountLogoutBtn: {
    minHeight: 48,
    backgroundColor: c.errorSoft,
    borderWidth: 1,
    borderColor: c.errorBorder,
    borderRadius: r.button,
    paddingVertical: sp.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLogoutBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  accountLogoutBtnText: {
    ...ty.button,
    color: c.error,
  },
  accountConnectBtn: {
    minHeight: L.buttonHeight,
    backgroundColor: c.primary,
    borderRadius: r.button,
    paddingVertical: sp.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...uiTheme.shadows.glow,
  },
  accountConnectBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
  },
  accountConnectBtnText: {
    ...ty.button,
    color: c.onPrimary,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
    marginVertical: sp.lg,
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
  },
  subStatusLabel: {
    ...ty.footnote,
    color: c.muted,
  },
  subStatusValue: {
    ...ty.label,
    color: c.text,
  },
  rawControlsBody: {
    marginTop: sp.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    paddingTop: sp.md,
  },

  // ─── Desktop V2 Toast Banner ───
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
    borderWidth: 1,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    marginHorizontal: sp.md,
    marginTop: sp.md,
    borderRadius: r.input,
    zIndex: 99,
  },
  toastBannerText: {
    ...ty.label,
    color: c.success,
    flexShrink: 1,
  },

  // ─── Desktop V2 Sticky Save Bar ───
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.elevated,
    borderTopWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    ...uiTheme.shadows.lg,
  },
  saveBarProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: c.primary,
    borderTopLeftRadius: r.md,
    borderTopRightRadius: r.md,
  },
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    flex: 1,
    minWidth: 0,
    marginRight: sp.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unsavedDot: {
    backgroundColor: c.warning,
  },
  savedDot: {
    backgroundColor: c.success,
  },
  saveBarText: {
    ...ty.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  saveBarTextUnsaved: {
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
  },
  saveBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  discardBtn: {
    minHeight: L.touchTarget,
    justifyContent: 'center',
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  discardBtnText: {
    ...ty.buttonSmall,
    color: c.textSecondary,
  },
  saveChangesBtn: {
    minHeight: L.touchTarget,
    backgroundColor: c.primary,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.lg,
    borderRadius: r.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...uiTheme.shadows.glow,
  },
  saveChangesBtnIdle: {
    backgroundColor: c.primary,
    opacity: 0.95,
  },
  saveChangesBtnSuccess: {
    backgroundColor: c.success,
    shadowColor: c.success,
  },
  saveChangesBtnText: {
    ...ty.buttonSmall,
    color: c.onPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  errorText: {
    ...ty.footnote,
    color: c.error,
    textAlign: 'center',
    marginBottom: sp.xs,
  },

  // ── Modal Styles ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderTopLeftRadius: r.sheet,
    borderTopRightRadius: r.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.hairline,
    paddingHorizontal: sp.xl,
    paddingTop: sp.xs,
    paddingBottom: sp.xl,
    maxHeight: '85%',
    ...uiTheme.shadows.lg,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.borderStrong,
    marginTop: sp.xs + 2,
    marginBottom: sp.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.divider,
    paddingBottom: sp.md,
    marginBottom: sp.md,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    ...ty.title2,
    color: c.text,
  },
  modalSubtitle: {
    ...ty.overline,
    color: c.muted,
    marginTop: sp.xxs,
  },
  modalCloseBtn: {
    backgroundColor: c.elevated,
    borderColor: c.hairline,
  },
  modalBody: {
    gap: sp.sm,
  },
  previewField: {
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
    marginBottom: sp.sm,
  },
  previewFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    marginBottom: sp.xs,
  },
  previewLabel: {
    ...ty.overline,
    color: c.muted,
    textTransform: 'uppercase',
  },
  previewValue: {
    ...ty.callout,
    color: c.text,
  },
  previewValueEmpty: {
    color: c.textTertiary,
    fontStyle: 'italic',
  },
  modalProfileStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.elevated,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    marginBottom: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
    gap: sp.sm,
  },
  modalProfileStatusText: {
    ...ty.footnote,
    color: c.text,
    flex: 1,
    minWidth: 0,
  },
  modalQuickSyncBtn: {
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: c.elevatedHigh,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  modalQuickSyncBtnText: {
    ...ty.buttonSmall,
    color: c.accent,
  },

  // ── Custom Logout Confirmation Modal ──
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp.xl,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: c.surface,
    borderRadius: r.sheet,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: sp.xxl,
    alignItems: 'center',
    ...uiTheme.shadows.lg,
  },
  logoutIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: c.errorSoft,
    borderWidth: 1,
    borderColor: c.errorBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sp.lg,
  },
  logoutModalTitle: {
    ...ty.title2,
    color: c.text,
    marginBottom: sp.sm,
    textAlign: 'center',
  },
  logoutModalSubtitle: {
    ...ty.callout,
    color: c.muted,
    textAlign: 'center',
    marginBottom: sp.xxl,
  },
  logoutModalBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    width: '100%',
  },
  logoutModalCancelBtn: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: r.button,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalCancelText: {
    ...ty.button,
    color: c.text,
  },
  logoutModalConfirmBtn: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: r.button,
    backgroundColor: c.danger,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: sp.sm,
  },
  logoutModalConfirmText: {
    ...ty.button,
    color: c.onPrimary,
  },

  // ── Target Location & Passport Styles ──
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    flex: 1,
    minWidth: 0,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: r.sm,
    backgroundColor: c.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    backgroundColor: c.primarySoft,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs + 1,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    maxWidth: 140,
  },
  locationActiveBadgeLive: {
    backgroundColor: c.successSoft,
    borderColor: c.successBorder,
  },
  locationActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  locationActiveDotLive: {
    backgroundColor: c.success,
  },
  locationActiveText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
  },
  locationActiveTextLive: {
    color: c.success,
  },

  // ── Live GPS Card ──
  liveGpsCard: {
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
    marginTop: sp.sm,
  },
  liveGpsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.sm,
  },
  liveGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.success,
  },
  liveGpsCity: {
    ...ty.headline,
    color: c.text,
  },
  liveGpsSub: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.xxs,
  },
  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
    minHeight: 36,
    backgroundColor: c.successSoft,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  refreshGpsBtnText: {
    ...ty.buttonSmall,
    color: c.success,
  },

  // ── Selected City Banner ──
  selectedCityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.sm,
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.md,
    borderWidth: 1,
    borderColor: c.hairline,
    marginTop: sp.sm,
  },
  selectedCityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: r.sm,
    backgroundColor: c.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCityTitle: {
    ...ty.bodyStrong,
    color: c.text,
  },
  selectedCitySub: {
    ...ty.footnote,
    color: c.muted,
    marginTop: sp.xxs,
  },
  passportActivePill: {
    backgroundColor: c.primarySoft,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs + 1,
    borderRadius: r.pill,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  passportActiveText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
    letterSpacing: 0.4,
  },

  // ── Popular Destination Chips ──
  quickLabel: {
    ...ty.overline,
    color: c.muted,
    marginBottom: sp.sm,
    textTransform: 'uppercase',
  },
  quickChipsScroll: {
    flexDirection: 'row',
    gap: sp.sm,
    paddingVertical: sp.xxs,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs + 2,
    minHeight: 36,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: r.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  quickChipActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  quickChipFlag: {
    ...ty.subhead,
    fontFamily: uiTheme.fonts.body,
  },
  quickChipText: {
    ...ty.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.textSecondary,
  },
  quickChipTextActive: {
    fontFamily: uiTheme.fonts.label,
    color: c.text,
  },

  // ── Hub Search & Filter ──
  hubSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    minHeight: L.touchTarget,
    backgroundColor: c.elevated,
    borderRadius: r.input,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: sp.md,
  },
  hubSearchInput: {
    ...ty.callout,
    flex: 1,
    minWidth: 0,
    color: c.text,
    paddingVertical: sp.xs,
  },
  regionFilterScroll: {
    marginTop: sp.sm,
    marginBottom: sp.xs,
  },
  regionFilterContainer: {
    flexDirection: 'row',
    gap: sp.sm,
    paddingVertical: sp.xxs,
  },
  regionTab: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: r.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  regionTabActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  regionTabText: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
  },
  regionTabTextActive: {
    fontFamily: uiTheme.fonts.strong,
    color: c.accent,
  },
  cityListScroll: {
    maxHeight: 220,
    marginTop: sp.sm,
    borderRadius: r.md,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    paddingBottom: sp.xs,
  },
  hubCard: {
    width: '48%',
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.sm + 2,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  hubCardActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primaryBorder,
  },
  hubCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.xs,
  },
  hubCardFlag: {
    ...ty.headline,
    fontFamily: uiTheme.fonts.body,
  },
  hubCountryCode: {
    ...ty.caption,
    fontFamily: uiTheme.fonts.strong,
    color: c.muted,
    backgroundColor: c.neutralSoft,
    paddingHorizontal: sp.xs,
    paddingVertical: 1,
    borderRadius: r.xs,
    overflow: 'hidden',
  },
  hubCardCity: {
    ...ty.footnote,
    fontFamily: uiTheme.fonts.strong,
    color: c.textSecondary,
  },
  hubCardCityActive: {
    color: c.text,
  },
  hubCardCountry: {
    ...ty.caption,
    color: c.muted,
    marginTop: 1,
  },
  noHubsFoundWrap: {
    alignItems: 'center',
    paddingVertical: sp.lg,
    gap: sp.xs,
  },
  noHubsFoundText: {
    ...ty.footnote,
    color: c.muted,
  },
  resetFilterText: {
    ...ty.buttonSmall,
    color: c.accent,
  },

  // ── Custom Location Accordion ──
  customAccordionToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: L.touchTarget,
    paddingVertical: sp.sm,
    marginTop: sp.xs,
  },
  customAccordionText: {
    ...ty.buttonSmall,
    color: c.muted,
  },
  customCoordsCard: {
    backgroundColor: c.elevated,
    borderRadius: r.md,
    padding: sp.md,
    marginTop: sp.xs,
    borderWidth: 1,
    borderColor: c.hairline,
    gap: sp.sm,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: sp.sm,
  },
  customInputHalf: {
    flex: 1,
    minWidth: 0,
  },
  customInputLabel: {
    ...ty.overline,
    color: c.muted,
    textTransform: 'uppercase',
    marginBottom: sp.xs,
  },
  customTextInput: {
    ...ty.callout,
    minHeight: L.touchTarget,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.sm,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    color: c.text,
  },
  locationNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: sp.md,
    paddingHorizontal: sp.xs,
  },
  locationNoteText: {
    ...ty.footnote,
    color: c.muted,
    flex: 1,
    minWidth: 0,
  },
  physicalGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp.md,
    minHeight: 56,
    backgroundColor: c.elevated,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm + 2,
    marginBottom: sp.sm,
  },
  physicalGpsLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: sp.sm,
  },
});
