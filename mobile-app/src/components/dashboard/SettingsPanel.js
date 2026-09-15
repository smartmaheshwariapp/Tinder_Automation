import { theme as uiTheme } from '../../theme';
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TINDER_ICON = require('../../../assets/flirteasy/tinder.jpg');

const SWIPE_PRESETS = [0, 10, 50, 100, 150];
const MSG_PRESETS = [0, 10, 50, 100, 150];
const SCHEDULE_PRESETS = [
  { label: '30min', value: 30 },
  { label: '60min', value: 60 },
  { label: '120min', value: 120 },
];

export { REGION_FILTERS, CITY_PRESETS } from '../../utils/locationHubs';
import { REGION_FILTERS, CITY_PRESETS } from '../../utils/locationHubs';
import LocationService from '../../services/locationService';
import LocationNoticeModal from '../common/LocationNoticeModal';
import { getTinderAuthState, subscribeTinderAuthState } from '../../utils/sessionManager';

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
        <ActivityIndicator size="small" color={uiTheme.colors.primary} />
        <Text style={styles.loadingText}>Syncing Linksy Settings...</Text>
      </View>
    );
  }

  const isSafetyOn = form.safetyMode !== false;

  // In Safety Mode ON, V2 enforces exact defaults: 50 swipes, 50 msgs, 120min schedule
  const activeSwipes = isSafetyOn ? 50 : (form.likesPerCycle ?? 50);
  const activeMsgs = isSafetyOn ? 50 : (form.messagesPerCycle ?? 50);
  const activeInterval = isSafetyOn ? 120 : (form.scheduleInterval ?? 120);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ════════════════════ CATEGORY 1: SAFETY ════════════════════ */}
        <Text style={styles.categoryLabel}>SAFETY</Text>

        <View style={styles.card}>
          {/* Section Header with Independent Safety Toggle & Chevron */}
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity accessibilityRole="button"
              style={styles.headerLeftTouchable}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSafetyCollapsed(!safetyCollapsed);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>Safety Mode</Text>
              <Ionicons
                name={safetyCollapsed ? 'chevron-down' : 'chevron-up'}
                size={16}
                color={uiTheme.colors.muted}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            <Switch
              value={isSafetyOn}
              onValueChange={v => {
                updateField('safetyMode', v);
              }}
              trackColor={{ false: uiTheme.colors.elevated, true: uiTheme.colors.primary }}
              thumbColor={isSafetyOn ? '#FFF' : uiTheme.colors.muted}
            />
          </View>

          {/* Collapsible Inner Content (Hidden when collapsed) */}
          {!safetyCollapsed && (
            <View style={{ marginTop: 8 }}>
              {/* 2 Independent Meter Boxes (Likes/hr: 0/50, Msgs/hr: 0/50) */}
              <View style={styles.metersRow}>
                <View style={styles.meterBox}>
                  <Text style={styles.meterLabel}>Likes/hr</Text>
                  <Text
                    style={[
                      styles.meterValue,
                      !isSafetyOn && styles.meterValueDanger,
                    ]}
                  >
                    {isSafetyOn ? '0/50' : 'No limit'}
                  </Text>
                </View>

                <View style={styles.meterBox}>
                  <Text style={styles.meterLabel}>Msgs/hr</Text>
                  <Text
                    style={[
                      styles.meterValue,
                      !isSafetyOn && styles.meterValueDanger,
                    ]}
                  >
                    {isSafetyOn ? '0/50' : 'No limit'}
                  </Text>
                </View>
              </View>

              {/* Badges Row (Auto-managed · Shadowban secure) */}
              <View style={styles.safetyFeaturesRow}>
                <View style={styles.safetyFeatureChip}>
                  <Ionicons
                    name={isSafetyOn ? "checkmark" : "close"}
                    size={13}
                    color={isSafetyOn ? "#16a34a" : uiTheme.colors.error}
                  />
                  <Text
                    style={[
                      styles.safetyFeatureText,
                      { color: isSafetyOn ? "#16a34a" : uiTheme.colors.error },
                    ]}
                  >
                    {isSafetyOn ? "Auto-managed" : "Manual overrides"}
                  </Text>
                </View>

                <View style={styles.safetyFeatureChip}>
                  <Ionicons
                    name={isSafetyOn ? "checkmark" : "warning"}
                    size={13}
                    color={isSafetyOn ? "#16a34a" : uiTheme.colors.error}
                  />
                  <Text
                    style={[
                      styles.safetyFeatureText,
                      { color: isSafetyOn ? "#16a34a" : uiTheme.colors.error },
                    ]}
                  >
                    {isSafetyOn ? "Shadowban secure" : "Shadowban risk"}
                  </Text>
                </View>
              </View>

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
                  <View style={styles.presetButtonGroup}>
                    {SWIPE_PRESETS.map(val => (
                      <TouchableOpacity accessibilityRole="button"
                        key={val}
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
                  <View style={styles.presetButtonGroup}>
                    {MSG_PRESETS.map(val => (
                      <TouchableOpacity accessibilityRole="button"
                        key={val}
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

                {/* Schedule Preset Row */}
                <View style={styles.presetRow}>
                  <Text style={styles.presetLabel}>Schedule AI agent every</Text>
                  <View style={styles.presetButtonGroup}>
                    {SCHEDULE_PRESETS.map(item => (
                      <TouchableOpacity accessibilityRole="button"
                        key={item.value}
                        disabled={isSafetyOn}
                        style={[
                          styles.presetBtn,
                          activeInterval === item.value && styles.presetBtnActive,
                        ]}
                        onPress={() => updateField('scheduleInterval', item.value)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.presetBtnText,
                            activeInterval === item.value && styles.presetBtnTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {isSafetyOn && (
                  <View style={styles.lockedNoteRow}>
                    <Ionicons name="lock-closed" size={12} color={uiTheme.colors.muted} style={{ marginRight: 6 }} />
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
                        form?.useDeviceLocation && { fontFamily: 'Inter_700Bold', color: '#FFF', fontWeight: 'normal' },
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
                        !form?.useDeviceLocation && { fontFamily: 'Inter_700Bold', color: '#FFF', fontWeight: 'normal' },
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
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 22 }}>
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
                      placeholderTextColor="#555268"
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
                      <Ionicons name="search-outline" size={22} color="#555268" />
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
                          placeholderTextColor="#555268"
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
                            placeholderTextColor="#555268"
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
                            placeholderTextColor="#555268"
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

        {/* ════════════════════ CATEGORY 2: AI PROFILE ════════════════════ */}
        <Text style={styles.categoryLabel}>AI PROFILE</Text>

        <View style={styles.card}>
          {/* Card Title Row with Chevron */}
          <TouchableOpacity accessibilityRole="button"
            style={styles.cardHeaderRow}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setBioCollapsed(!bioCollapsed);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitle}>Your Bio (Improve it with AI)</Text>
            <Ionicons
              name={bioCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={uiTheme.colors.muted}
            />
          </TouchableOpacity>

          {/* Segmented Mode Selector: Sync | Custom | Generate */}
          <View style={styles.segmentedSelector}>
            {BIO_MODES.map(bm => (
              <TouchableOpacity accessibilityRole="button"
                key={bm.id}
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
                >
                  {bm.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Collapsible Details Drawer */}
          {!bioCollapsed && (
            <View style={{ marginTop: 8 }}>

              {/* ── Panel 1: Sync with Live Dating Profile ── */}
              {bioMode === 'tinder' && (
                <View style={styles.bioSubPanel}>
                  <Text style={styles.bioPanelHint}>
                    Uses your live dating profile.
                  </Text>

                  <View style={styles.syncRow}>
                    <TouchableOpacity accessibilityRole="button"
                      style={styles.syncBtn}
                      onPress={handleSyncNow}
                      disabled={syncing}
                      activeOpacity={0.85}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.syncBtnText}>
                          {syncSuccess ? '✓ Synced' : 'Sync Now'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity accessibilityRole="button"
                      style={styles.previewEyeBtn}
                      onPress={() => setPreviewVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="eye-outline" size={15} color={uiTheme.colors.primary} />
                      <Text style={styles.previewEyeBtnText}>How AI Sees You</Text>
                    </TouchableOpacity>
                  </View>

                  {syncError ? (
                    <View style={styles.syncErrorCard}>
                      <Ionicons name="alert-circle" size={14} color={uiTheme.colors.error} />
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
                  <TextInput
                    style={styles.bioTextArea}
                    multiline={true}
                    placeholder="Enter your text here"
                    placeholderTextColor="#55526B"
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
                      <View style={styles.magicIconWrap}>
                        <Ionicons name="sparkles" size={24} color={uiTheme.colors.primary} />
                      </View>
                      <Text style={styles.magicTitle}>Generate a Magic Bio</Text>
                      <Text style={styles.magicDesc}>
                        Let AI analyze your profile and craft the perfect bio to maximize your matches.
                      </Text>
                      <TouchableOpacity accessibilityRole="button"
                        style={styles.magicCtaBtn}
                        onPress={handleRunGenerate}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="sparkles" size={14} color="#FFF" />
                        <Text style={styles.magicCtaBtnText}>Generate Bio Now</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {genStep === 1 && (
                    <View style={styles.genLoadingWrap}>
                      <ActivityIndicator size="small" color={uiTheme.colors.primary} />
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
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                          <Ionicons name="alert-circle" size={14} color={uiTheme.colors.error} />
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
                          activeOpacity={0.85}
                        >
                          {pushing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              {pushSuccess && (
                                <Ionicons name="checkmark-circle" size={14} color="#FFF" />
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
        <Text style={styles.categoryLabel}>ACCOUNT & SESSION</Text>

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
                <Text style={styles.accountTitle}>
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
              activeOpacity={0.85}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={uiTheme.colors.error} />
              ) : (
                <View style={styles.accountLogoutBtnInner}>
                  <Ionicons name="log-out-outline" size={16} color={uiTheme.colors.error} />
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
                <Ionicons name="flame" size={16} color="#FFFFFF" />
                <Text style={styles.accountConnectBtnText}>Log In to Tinder</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ════════════════════ CATEGORY 4: DIRECT KEYPAD ════════════════════ */}
        {rawControlsContent && (
          <>
            <Text style={styles.categoryLabel}>VIRTUAL CONTAINER CONTROLS</Text>
            <View style={styles.card}>
              <TouchableOpacity accessibilityRole="button"
                style={styles.cardHeaderRow}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowRawControls(!showRawControls);
                }}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="keypad-outline" size={16} color={uiTheme.colors.info} />
                  <Text style={styles.cardTitle}>Direct OTP & Keypad</Text>
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>How AI Sees You</Text>
                <Text style={styles.modalSubtitle}>YOUR SYNCED PROFILE CONTEXT</Text>
              </View>
              <TouchableOpacity accessibilityRole="button"
                style={styles.modalCloseBtn}
                onPress={() => setPreviewVisible(false)}
              >
                <Ionicons name="close" size={20} color={uiTheme.colors.text} />
              </TouchableOpacity>
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
              <Ionicons name="log-out" size={28} color={uiTheme.colors.error} />
            </View>

            <Text style={styles.logoutModalTitle}>Log Out of Tinder?</Text>
            <Text style={styles.logoutModalSubtitle}>
              This will end the active Tinder session and pause your AI automation assistant until you sign back in.
            </Text>

            <View style={styles.logoutModalBtnRow}>
              <TouchableOpacity accessibilityRole="button"
                style={styles.logoutModalCancelBtn}
                onPress={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button"
                style={styles.logoutModalConfirmBtn}
                onPress={executeLogout}
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

      {/* ─── Universal Synced Location Notice Modal ─── */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: uiTheme.spacing.xl,
    backgroundColor: uiTheme.colors.background,
  },
  loadingText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    marginTop: 10,
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 90,
    gap: 6,
  },

  categoryLabel: { fontFamily: 'Inter_600SemiBold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: uiTheme.spacing.xs,
    marginLeft: uiTheme.spacing.xs,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    padding: 14,
    marginBottom: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  headerLeftTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: uiTheme.spacing.xs,
  },
  cardTitle: { fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.1,
  },

  // ── 2 Independent Side-by-Side Meter Boxes ──
  metersRow: {
    flexDirection: 'row',
    gap: uiTheme.spacing.sm,
    marginTop: 10,
  },
  meterBox: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  meterLabel: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  meterValue: { fontFamily: 'Inter_700Bold',
    fontSize: 13,
    fontWeight: 'normal',
    color: '#FFF',
  },
  meterValueDanger: {
    color: uiTheme.colors.error,
  },

  // ── Badges Row ──
  safetyFeaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: 2,
    marginTop: uiTheme.spacing.xs,
  },
  safetyFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
  },
  safetyFeatureText: { fontFamily: 'Inter_500Medium',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Presets ──
  presetSection: {
    marginTop: 10,
    gap: uiTheme.spacing.md,
  },
  presetSectionLocked: {
    opacity: 0.55,
  },
  presetRow: {
    gap: 6,
  },
  presetLabel: { fontFamily: 'Inter_500Medium',
    color: '#9ca3af',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  presetButtonGroup: {
    flexDirection: 'row',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  presetBtnActive: {
    backgroundColor: uiTheme.colors.primary,
  },
  presetBtnText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  presetBtnTextActive: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontWeight: 'normal',
  },
  lockedNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: uiTheme.spacing.xs,
  },
  lockedNoteText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontStyle: 'italic',
    flex: 1,
  },

  // ── Segmented Mode Selector ──
  segmentedSelector: {
    flexDirection: 'row',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: '#221E33',
    marginTop: 10,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segBtnActive: {
    backgroundColor: uiTheme.colors.elevated,
  },
  segBtnText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  segBtnTextActive: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontWeight: 'normal',
  },

  bioSubPanel: {
    marginTop: 10,
  },
  bioPanelHint: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 16,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    marginTop: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.sm,
  },
  syncBtn: {
    flex: 1,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.small,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  previewEyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 9,
  },
  previewEyeBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  syncStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: uiTheme.spacing.sm,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  syncErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: uiTheme.radius.small,
    padding: uiTheme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  syncErrorText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.error,
    fontSize: uiTheme.type.caption.fontSize,
    flex: 1,
  },
  syncStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: uiTheme.colors.success,
  },
  syncStatusText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },

  bioTextArea: { fontFamily: 'Inter_400Regular',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: '#221E33',
    color: '#FFF',
    fontSize: 12.5,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  customBioFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  charCountText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },

  // ── Magic Bio Studio ──
  genStepWrap: {
    alignItems: 'center',
    paddingVertical: uiTheme.spacing.md,
  },
  magicIconWrap: {
    width: 44,
    height: 44,
    borderRadius: uiTheme.radius.input,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: uiTheme.spacing.sm,
  },
  magicTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: 'normal',
    marginBottom: uiTheme.spacing.xs,
  },
  magicDesc: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.md,
  },
  magicCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.small,
    paddingVertical: 10,
    paddingHorizontal: uiTheme.spacing.xl,
  },
  magicCtaBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: 'normal',
  },

  genLoadingWrap: {
    paddingVertical: uiTheme.spacing.xxl,
    alignItems: 'center',
    gap: 10,
  },
  genLoadingText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },

  genResultWrap: {
    gap: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: 10,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  scoreRing: {
    width: 40,
    height: 40,
    borderRadius: uiTheme.radius.card,
    borderWidth: 2.5,
    borderColor: uiTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  scoreLabel: { fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'normal',
  },
  activeScoreTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeScoreTagText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  scoreSub: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 2,
  },
  bioBoxResult: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  bioResultText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.text,
    fontSize: 12.5,
    lineHeight: 18,
  },
  genActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  genActionSecBtn: {
    backgroundColor: uiTheme.colors.elevated,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: 7,
  },
  genActionSecText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  genActionPushBtn: {
    flex: 1,
    backgroundColor: uiTheme.colors.primary,
    paddingVertical: uiTheme.spacing.sm,
    alignItems: 'center',
    borderRadius: 7,
  },
  genActionPushBtnSuccess: {
    backgroundColor: '#059669',
  },
  genActionPushText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Account & Platforms ──
  accountProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
  },
  accountIconWrap: {
    position: 'relative',
  },
  accountLogo: {
    width: 44,
    height: 44,
    borderRadius: uiTheme.radius.input,
  },
  accountActiveDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.success,
    borderWidth: 2,
    borderColor: '#151322',
  },
  accountInactiveDot: {
    backgroundColor: '#64748B',
    borderColor: '#151322',
  },
  accountInfoWrap: {
    flex: 1,
  },
  accountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  accountTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  accountPlanBadge: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  accountInactiveBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  accountPlanText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
  accountInactiveBadgeText: {
    color: '#94A3B8',
  },
  accountSubText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  accountLogoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLogoutBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountLogoutBtnText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.error,
    fontSize: 13,
    fontWeight: 'normal',
  },
  accountConnectBtn: {
    backgroundColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.input,
    paddingVertical: uiTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  accountConnectBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  accountConnectBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#221E33',
    marginVertical: uiTheme.spacing.md,
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subStatusLabel: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  subStatusValue: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'normal',
  },

  rawControlsBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#221E33',
    paddingTop: uiTheme.spacing.md,
  },

  // ─── Desktop V2 Toast Banner ───
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    backgroundColor: '#064E3B',
    borderColor: uiTheme.colors.success,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: uiTheme.spacing.lg,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: uiTheme.radius.input,
    zIndex: 99,
  },
  toastBannerText: { fontFamily: 'Inter_700Bold',
    color: '#ECFDF5',
    fontSize: 13,
    fontWeight: 'normal',
  },

  // ─── Desktop V2 Sticky Save Bar ───
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: uiTheme.colors.surface,
    borderTopWidth: 1,
    borderColor: uiTheme.colors.elevated,
    paddingHorizontal: 14,
    paddingVertical: uiTheme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  saveBarProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: uiTheme.colors.primary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unsavedDot: {
    backgroundColor: uiTheme.colors.warning,
  },
  savedDot: {
    backgroundColor: uiTheme.colors.success,
  },
  saveBarText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  saveBarTextUnsaved: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontWeight: 'normal',
  },
  saveBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  discardBtn: {
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: 13,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    backgroundColor: 'transparent',
  },
  discardBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.textSecondary,
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  saveChangesBtn: {
    backgroundColor: uiTheme.colors.primary,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.lg,
    borderRadius: uiTheme.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  saveChangesBtnIdle: {
    backgroundColor: '#E11D48',
    opacity: 0.95,
  },
  saveChangesBtnSuccess: {
    backgroundColor: uiTheme.colors.success,
    shadowColor: uiTheme.colors.success,
  },
  saveChangesBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  errorText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.error,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: 'center',
    marginBottom: 6,
  },

  // ── Modal Styles ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: uiTheme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    padding: uiTheme.spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#221E33',
    paddingBottom: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.md,
  },
  modalTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'normal',
  },
  modalSubtitle: { fontFamily: 'Manrope_700Bold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: uiTheme.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    gap: uiTheme.spacing.sm,
  },
  previewField: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: 10,
    borderWidth: 1,
    borderColor: '#221E33',
    marginBottom: 6,
  },
  previewFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  previewLabel: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    textTransform: 'uppercase',
  },
  previewValue: { fontFamily: 'Inter_400Regular',
    color: '#FFF',
    fontSize: 12.5,
    lineHeight: 17,
  },
  previewValueEmpty: {
    color: '#605D78',
    fontStyle: 'italic',
  },
  modalProfileStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161426',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    gap: uiTheme.spacing.sm,
  },
  modalProfileStatusText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    flex: 1,
  },
  modalQuickSyncBtn: {
    backgroundColor: uiTheme.colors.elevated,
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D385A',
  },
  modalQuickSyncBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Custom Logout Confirmation Modal ──
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 10, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: uiTheme.spacing.xxl,
  },
  logoutModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#141220',
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    padding: uiTheme.spacing.xxl,
    alignItems: 'center',
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  logoutModalTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.section.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.3,
    marginBottom: uiTheme.spacing.sm,
    textAlign: 'center',
  },
  logoutModalSubtitle: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
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
    borderRadius: uiTheme.radius.input,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalCancelText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: 'normal',
  },
  logoutModalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: uiTheme.radius.input,
    backgroundColor: uiTheme.colors.error,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: uiTheme.colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutModalConfirmText: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'normal',
  },

  // ── Target Location & Passport Styles ──
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    flex: 1,
  },
  locationIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 60, 114, 0.10)',
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    maxWidth: 140,
  },
  locationActiveBadgeLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  locationActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: uiTheme.colors.primary,
  },
  locationActiveDotLive: {
    backgroundColor: uiTheme.colors.success,
  },
  locationActiveText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  locationActiveTextLive: {
    color: uiTheme.colors.success,
  },

  // ── Live GPS Card ──
  liveGpsCard: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    padding: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: '#221E33',
    marginTop: uiTheme.spacing.sm,
  },
  liveGpsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: uiTheme.colors.success,
  },
  liveGpsCity: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  liveGpsSub: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginTop: 2,
  },
  refreshGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  refreshGpsBtnText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Selected City Banner ──
  selectedCityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    padding: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: '#221E33',
    marginTop: uiTheme.spacing.sm,
  },
  selectedCityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: uiTheme.radius.small,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCityTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  selectedCitySub: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 2,
  },
  passportActivePill: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  passportActiveText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },

  // ── Popular Destination Chips ──
  quickLabel: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    color: uiTheme.colors.muted,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  quickChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: uiTheme.radius.small,
    backgroundColor: uiTheme.colors.background,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  quickChipActive: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderColor: uiTheme.colors.primary,
  },
  quickChipFlag: { fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  quickChipText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  quickChipTextActive: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontWeight: 'normal',
  },

  // ── Hub Search & Filter ──
  hubSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#221E33',
    marginTop: 10,
  },
  hubSearchInput: { fontFamily: 'Inter_400Regular',
    flex: 1,
    color: '#FFF',
    fontSize: uiTheme.type.caption.fontSize,
    paddingVertical: 2,
  },
  regionFilterScroll: {
    marginTop: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.xs,
  },
  regionFilterContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  regionTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.background,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  regionTabActive: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderColor: uiTheme.colors.primary,
  },
  regionTabText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  regionTabTextActive: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontWeight: 'normal',
  },
  cityListScroll: {
    maxHeight: 220,
    marginTop: uiTheme.spacing.sm,
    borderRadius: uiTheme.radius.small,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: uiTheme.spacing.xs,
  },
  hubCard: {
    width: '48.8%',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: uiTheme.spacing.sm,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  hubCardActive: {
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
    borderColor: uiTheme.colors.primary,
  },
  hubCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: uiTheme.spacing.xs,
  },
  hubCardFlag: { fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  hubCountryCode: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: uiTheme.spacing.xs,
    paddingVertical: 1,
    borderRadius: 3,
  },
  hubCardCity: { fontFamily: 'Inter_700Bold',
    color: '#E2E1EC',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  hubCardCityActive: {
    color: '#FFF',
  },
  hubCardCountry: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 1,
  },
  noHubsFoundWrap: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: uiTheme.spacing.xs,
  },
  noHubsFoundText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },
  resetFilterText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Custom Location Accordion ──
  customAccordionToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  customAccordionText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  customCoordsCard: {
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: 10,
    marginTop: uiTheme.spacing.xs,
    borderWidth: 1,
    borderColor: '#221E33',
    gap: uiTheme.spacing.sm,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: uiTheme.spacing.sm,
  },
  customInputHalf: {
    flex: 1,
  },
  customInputLabel: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    textTransform: 'uppercase',
    marginBottom: uiTheme.spacing.xs,
    letterSpacing: 0.5,
  },
  customTextInput: { fontFamily: 'Inter_400Regular',
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFF',
    fontSize: uiTheme.type.caption.fontSize,
  },
  locationNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: uiTheme.spacing.xs,
  },
  locationNoteText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    flex: 1,
    lineHeight: 15,
  },
  physicalGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 10,
    marginBottom: 6,
  },
  physicalGpsLeft: {
    flex: 1,
    paddingRight: 10,
  },

});

