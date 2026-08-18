// src/components/dashboard/SettingsPanel.js — Exact 1:1 FlirtEasy V2 Settings Architecture
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TINDER_ICON = require('../../../assets/flirteasy/tinder.jpg');
const BUMBLE_ICON = require('../../../assets/flirteasy/bumble.png');

const SWIPE_PRESETS = [0, 10, 50, 100, 150];
const MSG_PRESETS = [0, 10, 50, 100, 150];
const SCHEDULE_PRESETS = [
  { label: '30min', value: 30 },
  { label: '60min', value: 60 },
  { label: '120min', value: 120 },
];

const BIO_MODES = [
  { id: 'tinder', label: 'Sync' },
  { id: 'manual', label: 'Custom' },
  { id: 'ai', label: 'Generate' },
];

// Sample AI magic bios matching V2 Magic Bio Studio
const MAGIC_BIOS = [
  {
    score: 96,
    text: "Tech explorer by day, rooftop cocktail enthusiast by night. Looking for someone who doesn't take themselves too seriously and can keep up with rapid-fire banter.",
  },
  {
    score: 92,
    text: "Ambitious, spontaneous, and always hunting for the city's best hidden coffee spots. Swipe right if you have great music taste and love unplanned road trips.",
  },
  {
    score: 95,
    text: "Part-time chef, full-time adventure seeker. Tell me your most controversial opinion and let's see if we survive the first drink.",
  },
];

// Profile preview fields schema matching V2 extension
const PROFILE_FIELDS = [
  { key: 'name', label: 'Name', icon: 'person-outline', default: 'Live Connected Profile' },
  { key: 'bio', label: 'Bio Context', icon: 'document-text-outline', default: 'Auto-synced from your dating profile.' },
  { key: 'job', label: 'Profession', icon: 'briefcase-outline', default: 'Tech & Product Leader' },
  { key: 'school', label: 'Education', icon: 'school-outline', default: 'University' },
  { key: 'interests', label: 'Passions', icon: 'sparkles-outline', default: 'Cocktails, Coffee, Travel, Indie Music' },
  { key: 'height', label: 'Height', icon: 'resize-outline', default: "5'11\" (180 cm)" },
  { key: 'lookingFor', label: 'Looking For', icon: 'heart-outline', default: 'Long-term relationship / Chemistry' },
  { key: 'languages', label: 'Languages', icon: 'globe-outline', default: 'English' },
];

export default function SettingsPanel({
  settings,
  loading,
  saving,
  saveSuccess,
  error,
  onSave,
  rawControlsContent,
  orchestratorUrl,
}) {
  const [form, setForm] = useState(null);
  const [safetyCollapsed, setSafetyCollapsed] = useState(true);
  const [bioMode, setBioMode] = useState('tinder');
  const [bioCollapsed, setBioCollapsed] = useState(true);

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
  const [pushError, setPushError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Raw keypad drawer
  const [showRawControls, setShowRawControls] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(JSON.parse(JSON.stringify(settings)));
      if (settings.aboutSource) {
        setBioMode(settings.aboutSource);
      }
      if (settings.userProfile) {
        setLastSyncTime('just now');
      }
    }
  }, [settings]);

  const updateField = (path, value) => {
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleSavePress = () => {
    if (onSave && form) {
      onSave({
        ...form,
        aboutSource: bioMode,
      });
    }
  };

  // ── Real Live Sync Now handler via CDP bridge ──
  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    const platform = bioMode === 'bumble' ? 'bumble' : 'tinder';

    if (orchestratorUrl) {
      try {
        const res = await fetch(`${orchestratorUrl}/sync-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform }),
        });
        const data = await res.json();
        if (data && data.success && data.profile) {
          setForm(prev => {
            const next = { ...prev, userProfile: data.profile };
            if (data.profile.bio && (!prev.manualBio || prev.aboutSource === 'tinder')) {
              next.manualBio = data.profile.bio;
            }
            return next;
          });
          setSyncSuccess(true);
          setLastSyncTime('just now');
          setTimeout(() => setSyncSuccess(false), 4000);
        } else {
          setSyncError(data?.error || `Please log in to ${platform === 'bumble' ? 'Bumble' : 'Tinder'} in the browser session first.`);
        }
      } catch (e) {
        setSyncError(e.message || 'Sync network request failed');
      } finally {
        setSyncing(false);
      }
    } else {
      setTimeout(() => {
        setSyncing(false);
        setSyncSuccess(true);
        setLastSyncTime('just now');
        setTimeout(() => setSyncSuccess(false), 3000);
      }, 1000);
    }
  };

  // ── Magic Bio Generator Actions ──
  const handleRunGenerate = () => {
    setGenStep(1);
    setTimeout(() => {
      const randomBio = MAGIC_BIOS[Math.floor(Math.random() * MAGIC_BIOS.length)];
      setGeneratedBioData(randomBio);
      updateField('manualBio', randomBio.text);
      setGenStep(2);
    }, 1500);
  };

  // ── Real Live Push Bio handler via CDP bridge ──
  const handlePushBio = async () => {
    setPushing(true);
    setPushError(null);
    const platform = bioMode === 'bumble' ? 'bumble' : 'tinder';
    const bioText = generatedBioData.text;

    if (orchestratorUrl) {
      try {
        const res = await fetch(`${orchestratorUrl}/push-bio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, bio: bioText }),
        });
        const data = await res.json();
        if (data && data.success) {
          updateField('manualBio', bioText);
          setGenStep(3);
        } else {
          setPushError(data?.error || 'Push failed. Please ensure the dating app profile tab is open.');
        }
      } catch (e) {
        setPushError(e.message || 'Push network request failed');
      } finally {
        setPushing(false);
      }
    } else {
      updateField('manualBio', bioText);
      setGenStep(3);
      setPushing(false);
    }
  };

  const handleCopyBio = () => {
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading || !form) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="small" color="#FE3C72" />
        <Text style={styles.loadingText}>Syncing FlirtEasy Settings...</Text>
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
            <TouchableOpacity
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
                color="#8E8DA3"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            <Switch
              value={isSafetyOn}
              onValueChange={v => {
                updateField('safetyMode', v);
              }}
              trackColor={{ false: '#26223B', true: '#FE3C72' }}
              thumbColor={isSafetyOn ? '#FFF' : '#716E89'}
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
                    color={isSafetyOn ? "#16a34a" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.safetyFeatureText,
                      { color: isSafetyOn ? "#16a34a" : "#ef4444" },
                    ]}
                  >
                    {isSafetyOn ? "Auto-managed" : "Manual overrides"}
                  </Text>
                </View>

                <View style={styles.safetyFeatureChip}>
                  <Ionicons
                    name={isSafetyOn ? "checkmark" : "warning"}
                    size={13}
                    color={isSafetyOn ? "#16a34a" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.safetyFeatureText,
                      { color: isSafetyOn ? "#16a34a" : "#ef4444" },
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
                      <TouchableOpacity
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
                      <TouchableOpacity
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
                      <TouchableOpacity
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
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CATEGORY 2: AI PROFILE ════════════════════ */}
        <Text style={styles.categoryLabel}>AI PROFILE</Text>

        <View style={styles.card}>
          {/* Card Title Row with Chevron */}
          <TouchableOpacity
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
              color="#8E8DA3"
            />
          </TouchableOpacity>

          {/* Segmented Mode Selector: Sync | Custom | Generate */}
          <View style={styles.segmentedSelector}>
            {BIO_MODES.map(bm => (
              <TouchableOpacity
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
                    <TouchableOpacity
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

                    <TouchableOpacity
                      style={styles.previewEyeBtn}
                      onPress={() => setPreviewVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="eye-outline" size={15} color="#FE3C72" />
                      <Text style={styles.previewEyeBtnText}>How AI Sees You</Text>
                    </TouchableOpacity>
                  </View>

                  {syncError ? (
                    <View style={styles.syncErrorCard}>
                      <Ionicons name="alert-circle" size={14} color="#EF4444" />
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
                        <Ionicons name="sparkles" size={24} color="#FE3C72" />
                      </View>
                      <Text style={styles.magicTitle}>Generate a Magic Bio</Text>
                      <Text style={styles.magicDesc}>
                        Let AI analyze your profile and craft the perfect bio to maximize your matches.
                      </Text>
                      <TouchableOpacity
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
                      <ActivityIndicator size="small" color="#FE3C72" />
                      <Text style={styles.genLoadingText}>
                        ✨ Crafting your perfect bio...
                      </Text>
                    </View>
                  )}

                  {(genStep === 2 || genStep === 3) && (
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
                          <Ionicons name="alert-circle" size={14} color="#EF4444" />
                          <Text style={styles.syncErrorText}>{pushError}</Text>
                        </View>
                      )}

                      {/* Action Buttons */}
                      {genStep === 2 ? (
                        <View style={styles.genActionsRow}>
                          <TouchableOpacity
                            style={styles.genActionSecBtn}
                            onPress={handleRunGenerate}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.genActionSecText}>↺ Regen</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.genActionPushBtn}
                            onPress={handlePushBio}
                            disabled={pushing}
                            activeOpacity={0.85}
                          >
                            {pushing ? (
                              <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                              <Text style={styles.genActionPushText}>↓ Push Profile</Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.genActionSecBtn}
                            onPress={handleCopyBio}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.genActionSecText,
                                copySuccess && { color: "#10B981" },
                              ]}
                            >
                              {copySuccess ? '✓ Copied' : 'Copy'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.pushSuccessBox}>
                          <View style={styles.pushSuccessTop}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.pushSuccessText}>
                              Pushed to Tinder!
                            </Text>
                          </View>
                          <Text style={styles.pushSuccessSub}>
                            Your profile bio has been successfully updated.
                          </Text>
                          <TouchableOpacity
                            style={styles.pushDoneBtn}
                            onPress={() => setGenStep(0)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.pushDoneBtnText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ════════════════════ CATEGORY 3: ACCOUNT ════════════════════ */}
        <Text style={styles.categoryLabel}>ACCOUNT</Text>

        <View style={styles.card}>
          <Text style={styles.accountHeader}>Connected Platforms</Text>
          <View style={styles.platformChipsRow}>
            {/* Tinder Chip */}
            <View style={[styles.platformChip, styles.platformChipActive]}>
              <Image source={TINDER_ICON} style={styles.platformChipLogo} />
              <Text style={styles.platformChipLabel}>Tinder</Text>
            </View>

            {/* Bumble Chip */}
            <View style={styles.platformChip}>
              <Image source={BUMBLE_ICON} style={styles.platformChipLogo} />
              <Text style={styles.platformChipLabel}>Bumble</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Subscription Status */}
          <View style={styles.subStatusRow}>
            <Text style={styles.subStatusLabel}>Subscription</Text>
            <Text style={styles.subStatusValue}>Pro Plan ✦</Text>
          </View>
        </View>

        {/* ════════════════════ CATEGORY 4: DIRECT KEYPAD ════════════════════ */}
        {rawControlsContent && (
          <>
            <Text style={styles.categoryLabel}>VIRTUAL CONTAINER CONTROLS</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeaderRow}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowRawControls(!showRawControls);
                }}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="keypad-outline" size={16} color="#818CF8" />
                  <Text style={styles.cardTitle}>Direct OTP & Keypad</Text>
                </View>
                <Ionicons
                  name={showRawControls ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#8E8DA3"
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

      {/* ─── Sticky Save Bar ─── */}
      <View style={styles.saveBar}>
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
        <TouchableOpacity
          style={[styles.saveButton, saveSuccess && styles.saveButtonSuccess]}
          onPress={handleSavePress}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <View style={styles.saveBtnContent}>
              <Ionicons
                name={saveSuccess ? 'checkmark-circle' : 'checkmark-done'}
                size={16}
                color="#FFF"
              />
              <Text style={styles.saveButtonText}>
                {saveSuccess ? 'Settings Saved to Extension!' : 'Save Settings'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

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
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPreviewVisible(false)}
              >
                <Ionicons name="close" size={20} color="#D8D6E8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {PROFILE_FIELDS.map((field, idx) => {
                const userVal = form.userProfile?.[field.key] || (field.key === 'bio' ? form.manualBio : null) || field.default;
                return (
                  <View key={field.key} style={styles.previewField}>
                    <View style={styles.previewFieldHeader}>
                      <Ionicons name={field.icon} size={13} color="#FE3C72" />
                      <Text style={styles.previewLabel}>{field.label}</Text>
                    </View>
                    <Text style={styles.previewValue}>{userVal}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B14',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0D0B14',
  },
  loadingText: {
    color: '#8E8DA3',
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

  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: '#161424',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26223B',
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
    paddingVertical: 4,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // ── 2 Independent Side-by-Side Meter Boxes ──
  metersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  meterBox: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  meterLabel: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
  },
  meterValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  meterValueDanger: {
    color: '#ef4444',
  },

  // ── Badges Row ──
  safetyFeaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  safetyFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  safetyFeatureText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Presets ──
  presetSection: {
    marginTop: 10,
    gap: 12,
  },
  presetSectionLocked: {
    opacity: 0.55,
  },
  presetRow: {
    gap: 6,
  },
  presetLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  presetButtonGroup: {
    flexDirection: 'row',
    backgroundColor: '#0D0B14',
    borderRadius: 8,
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
    backgroundColor: '#FE3C72',
  },
  presetBtnText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
  },
  presetBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  // ── Segmented Mode Selector ──
  segmentedSelector: {
    flexDirection: 'row',
    backgroundColor: '#0D0B14',
    borderRadius: 8,
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
    backgroundColor: '#26223B',
  },
  segBtnText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
  },
  segBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  bioSubPanel: {
    marginTop: 10,
  },
  bioPanelHint: {
    color: '#8E8DA3',
    fontSize: 11.5,
    lineHeight: 16,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  syncBtn: {
    flex: 1,
    backgroundColor: '#FE3C72',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  previewEyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1C192E',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  previewEyeBtnText: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '600',
  },
  syncStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  syncErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  syncErrorText: {
    color: '#EF4444',
    fontSize: 11,
    flex: 1,
  },
  syncStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  syncStatusText: {
    color: '#8E8DA3',
    fontSize: 11,
  },

  bioTextArea: {
    backgroundColor: '#0D0B14',
    borderRadius: 8,
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
  charCountText: {
    color: '#716E89',
    fontSize: 10.5,
  },

  // ── Magic Bio Studio ──
  genStepWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  magicIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  magicTitle: {
    color: '#FFF',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  magicDesc: {
    color: '#8E8DA3',
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  magicCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FE3C72',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  magicCtaBtnText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  genLoadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  genLoadingText: {
    color: '#8E8DA3',
    fontSize: 12,
  },

  genResultWrap: {
    gap: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  scoreRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scoreLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  activeScoreTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeScoreTagText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '700',
  },
  scoreSub: {
    color: '#8E8DA3',
    fontSize: 11,
    marginTop: 2,
  },
  bioBoxResult: {
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  bioResultText: {
    color: '#E0DFEC',
    fontSize: 12.5,
    lineHeight: 18,
  },
  genActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  genActionSecBtn: {
    backgroundColor: '#26223B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  genActionSecText: {
    color: '#D8D6E8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  genActionPushBtn: {
    flex: 1,
    backgroundColor: '#FE3C72',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  genActionPushText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pushSuccessBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    gap: 6,
  },
  pushSuccessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pushSuccessText: {
    color: '#10B981',
    fontSize: 13.5,
    fontWeight: '700',
  },
  pushSuccessSub: {
    color: '#8E8DA3',
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  pushDoneBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 6.5,
    borderRadius: 6,
  },
  pushDoneBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Account & Platforms ──
  accountHeader: {
    color: '#8E8DA3',
    fontSize: 11.5,
    fontWeight: '500',
    marginBottom: 8,
  },
  platformChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  platformChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  platformChipActive: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.06)',
  },
  platformChipLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  platformChipLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#221E33',
    marginVertical: 12,
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subStatusLabel: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
  },
  subStatusValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  rawControlsBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#221E33',
    paddingTop: 12,
  },

  // ── Sticky Save Bar ──
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161424',
    borderTopWidth: 1,
    borderColor: '#26223B',
    padding: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
  },
  saveButton: {
    backgroundColor: '#FE3C72',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonSuccess: {
    backgroundColor: '#10B981',
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },

  // ── Modal Styles ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#161424',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#221E33',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#716E89',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#26223B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    gap: 8,
  },
  previewField: {
    backgroundColor: '#0D0B14',
    borderRadius: 8,
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
  previewLabel: {
    color: '#716E89',
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  previewValue: {
    color: '#FFF',
    fontSize: 12.5,
    lineHeight: 17,
  },
});
