import { theme as uiTheme } from '../theme';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import ActivityIndicator from '../components/common/SafeActivityIndicator';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { resolveLocalUrl } from '../utils/network';
import { terminatePreviousSessions, registerActiveSession, startHyperbeamCloudSession, getSharedExtensionSettings } from '../utils/sessionManager';
import NotificationService from '../services/notifications';

const V2_GOALS = [
  { id: 'date', label: 'Set up a Date', icon: 'calendar-outline' },
  { id: 'phone', label: 'WhatsApp / Phone', icon: 'logo-whatsapp' },
  { id: 'instagram', label: 'Instagram Handle', icon: 'logo-instagram' },
  { id: 'move_to_telegram', label: 'Move to Telegram', icon: 'paper-plane-outline' },
  { id: 'never', label: 'Keep Engaging', icon: 'infinite-outline' },
];

export default function PlatformConfigScreen({ route, navigation }) {
  const { platform, vpsUrl: rawVpsUrl, proxyIp } = route.params;
  const vpsUrl = resolveLocalUrl(rawVpsUrl);
  const [loading, setLoading] = useState(false);

  // V2 Dating Goal & Contact Handle
  const [selectedGoal, setSelectedGoal] = useState('date');
  const [contactHandle, setContactHandle] = useState('');

  // Cycle settings
  const [likesPerCycle, setLikesPerCycle] = useState(50);
  const [messagesPerCycle, setMessagesPerCycle] = useState(20);
  const [scheduleInterval, setScheduleInterval] = useState(30);
  const [sessionDuration, setSessionDuration] = useState(30); // 15, 30, 45, 60 mins or 0 (no limit)

  // AI Prompt settings
  const [useCustomIntro, setUseCustomIntro] = useState(false);
  const [customIntroPrompt, setCustomIntroPrompt] = useState("Hey, I noticed your profile... let's chat!");

  // Push Notification Preferences
  const [notifyGoals, setNotifyGoals] = useState(true);
  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyCycles, setNotifyCycles] = useState(true);

  // External App Redirect Preferences
  const [redirectPrefs, setRedirectPrefs] = useState(NotificationService.getRedirectPreferences());

  useEffect(() => {
    const unsub = NotificationService.subscribeRedirectPreferences((prefs) => {
      setRedirectPrefs(prefs);
    });
    return unsub;
  }, []);

  const increment = (value, setter, step = 5, max = 200) => {
    setter(prev => Math.min(prev + step, max));
  };

  const decrement = (value, setter, step = 5, min = 0) => {
    setter(prev => Math.max(prev - step, min));
  };

  const HYPERBEAM_KEY = 'sk_test_fsuC8naqJLF2lGcL8Vak2ogGyhYFldLzqCEbX2zQYf0';

  const handleStartSession = async () => {
    setLoading(true);

    let host = 'api.smartmaheshwari.com';
    let protocol = vpsUrl.startsWith('https') ? 'https:' : 'http:';
    try {
      const cleanUrl = vpsUrl.includes('://') ? vpsUrl : 'https://' + vpsUrl;
      const match = cleanUrl.match(/^(https?:)\/\/([^:/]+)/);
      if (match) {
        protocol = match[1];
        host = match[2];
      }
    } catch (_) { }

    let apiHost = host.startsWith('stream.') ? host.replace('stream.', 'api.') : host;
    const resolvedOrchestratorUrl = (apiHost.includes('localhost') || apiHost.includes('127.0.0.1'))
      ? `http://${apiHost}:3001`
      : `https://${apiHost}`;

    // ─── Terminate any other currently active sessions first ───
    await terminatePreviousSessions(resolvedOrchestratorUrl, HYPERBEAM_KEY);

    const isOnDevice = vpsUrl === 'on_device' || route.params?.environment === 'on_device';
    const isHyperbeam = vpsUrl === 'hyperbeam' || route.params?.environment === 'hyperbeam';

    if (isOnDevice) {
      setLoading(false);
      navigation.navigate('Browser', {
        platform,
        vpsUrl: 'https://tinder.com',
        isOnDevice: true,
        environment: 'on_device',
        sessionDuration,
        extensionSettings: {
          ...getSharedExtensionSettings(),
          likesPerCycle,
          messagesPerCycle,
          selectedGoal,
          contactHandle,
          customIntroPrompt,
          useCustomIntro,
        }
      });
      return;
    }

    // Desktop Web View resolution (1280x720) so full website Login buttons are visible
    const webWidth = 1280;
    const webHeight = 720;
    console.log(`[Mobile] Desktop Web View Resolution: ${webWidth}x${webHeight}`);

    if (isHyperbeam) {
      try {
        const realProxy = proxyIp;

        const { embedUrl, sessionId, profileId } = await startHyperbeamCloudSession({
          platform,
          proxyIp: realProxy,
          orchestratorUrl: resolvedOrchestratorUrl,
        });

        setLoading(false);
        navigation.navigate('Browser', {
          platform,
          vpsUrl: embedUrl,
          proxyIp: realProxy,
          isHyperbeam: true,
          sessionDuration,
          orchestratorUrl: resolvedOrchestratorUrl,
          extensionSettings: {
            likesPerCycle,
            messagesPerCycle,
            selectedGoal,
            contactHandle,
            customIntroPrompt,
            useCustomIntro,
          }
        });
        return;
      } catch (hbErr) {
        console.error('[Mobile] Hyperbeam startup error:', hbErr);
        setLoading(false);
        Alert.alert(
          'Hyperbeam Session Failed',
          `Could not start Hyperbeam Cloud Browser: ${hbErr.message}\n\nPlease check your Hyperbeam API key or switch to Local Docker environment.`
        );
        return;
      }
    }

    const payload = JSON.stringify({
      platform: platform.toLowerCase(),
      userId: 'dev_user_1',
      proxyIp: proxyIp || '',
      goal: selectedGoal,
      contactHandle: contactHandle,
    });

    const urlsToTry = [
      `https://${apiHost}/start-session`,
      `http://${apiHost}:3001/start-session`,
      `https://${apiHost}:3001/start-session`,
    ];

    for (const url of urlsToTry) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (resp.ok) break;
      } catch (_) { }
    }

    const nekoPlayerUrl = (vpsUrl && vpsUrl.includes('://'))
      ? vpsUrl
      : `https://${host}/?usr=User&pwd=admin`;

    registerActiveSession({
      isHyperbeam: false,
      platform,
      vpsUrl: nekoPlayerUrl,
      orchestratorUrl: resolvedOrchestratorUrl
    });

    setLoading(false);
    navigation.navigate('Browser', {
      platform,
      vpsUrl: nekoPlayerUrl,
      proxyIp,
      isHyperbeam: false
    });
  };

  const themeColor = platform.toLowerCase() === 'tinder' ? uiTheme.colors.primary : '#FFB800';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={uiTheme.colors.background} />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Initializing Session...</Text>
          <Text style={styles.loadingSubtext}>Connecting to browser container</Text>
        </View>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={uiTheme.colors.text} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>{platform} Launch Setup</Text>
            <Text style={[styles.headerSubtitle, { color: themeColor }]}>Flint V2 Engine</Text>
          </View>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Section 1: Dating Goal Selection (V2) */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="flag-outline" size={16} color={themeColor} />
                <Text style={styles.sectionHeader}>Primary Dating Goal</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>Select how the AI Wingman steers and closes conversations:</Text>

            <View style={styles.goalGrid}>
              {V2_GOALS.map(goal => (
                <TouchableOpacity accessibilityRole="button"
                  key={goal.id}
                  style={[styles.goalPill, selectedGoal === goal.id && { borderColor: themeColor, backgroundColor: themeColor + '12' }]}
                  onPress={() => setSelectedGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={goal.icon}
                    size={14}
                    color={selectedGoal === goal.id ? themeColor : uiTheme.colors.muted}
                  />
                  <Text style={[styles.goalPillText, selectedGoal === goal.id && { fontFamily: 'Inter_700Bold', color: '#FFF', fontWeight: 'normal' }]}>
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedGoal !== 'never' && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>
                  {selectedGoal === 'phone' ? 'WhatsApp / Phone Number' : selectedGoal === 'instagram' ? 'Instagram Username' : selectedGoal === 'move_to_telegram' ? 'Telegram Handle' : 'Contact Handle for Date Logistics'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={selectedGoal === 'phone' ? '+1 (234) 567-8900' : '@username'}
                  placeholderTextColor={uiTheme.colors.muted}
                  value={contactHandle}
                  onChangeText={setContactHandle}
                  autoCapitalize="none"
                />
              </View>
            )}
          </View>

          {/* Section: Session Duration / Alarm Clock Span */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="timer-outline" size={16} color={themeColor} />
                <Text style={styles.sectionHeader}>Session Duration Timer</Text>
              </View>
              <View style={[styles.activePill, { backgroundColor: '#10B98118', borderColor: '#10B98140' }]}>
                <Text style={[styles.activePillText, { color: uiTheme.colors.success }]}>Alarm Clock UI</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>Automation automatically stops after the selected duration until you start it again.</Text>

            <View style={styles.durationRow}>
              {[
                { mins: 15, label: '15 Min' },
                { mins: 30, label: '30 Min' },
                { mins: 45, label: '45 Min' },
                { mins: 60, label: '60 Min' },
                { mins: 0, label: 'No Limit' }
              ].map(opt => (
                <TouchableOpacity accessibilityRole="button"
                  key={opt.mins}
                  style={[
                    styles.durationPill,
                    sessionDuration === opt.mins && { backgroundColor: themeColor, borderColor: themeColor }
                  ]}
                  onPress={() => setSessionDuration(opt.mins)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.durationPillText,
                    sessionDuration === opt.mins && styles.durationPillTextActive
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Section 2: Daily Pacing */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="speedometer-outline" size={16} color={themeColor} />
                <Text style={styles.sectionHeader}>Daily Pacing & Safety</Text>
              </View>
              <View style={[styles.activePill, { backgroundColor: themeColor + '18', borderColor: themeColor + '40' }]}>
                <Text style={[styles.activePillText, { color: themeColor }]}>Safe Pacing</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>Set how many profiles to like and message each session to keep your profile active and natural.</Text>

            {/* Likes Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Likes per Session</Text>
                <Text style={styles.stepperHelper}>Target profiles to like</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={() => decrement(likesPerCycle, setLikesPerCycle, 10, 0)}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{likesPerCycle}</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={() => increment(likesPerCycle, setLikesPerCycle, 10, 200)}>
                  <Feather name="plus" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Messages Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Intro Messages per Session</Text>
                <Text style={styles.stepperHelper}>First messages to new matches</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={() => decrement(messagesPerCycle, setMessagesPerCycle, 5, 0)}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{messagesPerCycle}</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={() => increment(messagesPerCycle, setMessagesPerCycle, 5, 100)}>
                  <Feather name="plus" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Interval Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Break Between Sessions</Text>
                <Text style={styles.stepperHelper}>Rest time before next session</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={() => decrement(scheduleInterval, setScheduleInterval, 5, 5)}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.stepperValueWrapper}>
                  <Text style={styles.stepperValue}>{scheduleInterval}</Text>
                  <Text style={styles.stepperUnit}>min</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" style={styles.stepBtn} onPress={() => increment(scheduleInterval, setScheduleInterval, 5, 1440)}>
                  <Feather name="plus" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 3: Custom First Message */}
          <View style={styles.sectionCard}>
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="chatbubbles-outline" size={16} color={themeColor} />
                  <Text style={styles.sectionHeader}>Custom First Message</Text>
                </View>
                <Text style={styles.sectionDesc}>Personalize how your assistant breaks the ice.</Text>
              </View>
              <Switch
                value={useCustomIntro}
                onValueChange={setUseCustomIntro}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={useCustomIntro ? '#FFF' : uiTheme.colors.muted}
              />
            </View>

            {useCustomIntro && (
              <View style={styles.expandableContent}>
                <Text style={styles.inputLabel}>Intro Message Instructions</Text>
                <TextInput
                  style={styles.textArea}
                  value={customIntroPrompt}
                  onChangeText={setCustomIntroPrompt}
                  multiline={true}
                  placeholder="Tell your assistant how you like to start conversations..."
                  placeholderTextColor={uiTheme.colors.muted}
                  numberOfLines={3}
                />
              </View>
            )}
          </View>

          {/* Section 4: Push Notification Preferences */}
          <View style={styles.sectionCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="notifications-outline" size={16} color={themeColor} />
              <Text style={styles.sectionHeader}>Notification Preferences</Text>
            </View>
            <Text style={styles.sectionDesc}>Choose which updates you want to receive on your phone.</Text>

            {/* Toggle 1: Goal Alerts */}
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Milestones & Phone Numbers</Text>
                <Text style={styles.stepperHelper}>Get notified when a match shares their phone or date</Text>
              </View>
              <Switch
                value={notifyGoals}
                onValueChange={setNotifyGoals}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={notifyGoals ? '#FFF' : uiTheme.colors.muted}
              />
            </View>

            <View style={styles.divider} />

            {/* Toggle 2: New Match Sparks */}
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>New Matches</Text>
                <Text style={styles.stepperHelper}>Get notified when someone matches with you</Text>
              </View>
              <Switch
                value={notifyMatches}
                onValueChange={setNotifyMatches}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={notifyMatches ? '#FFF' : uiTheme.colors.muted}
              />
            </View>

            <View style={styles.divider} />

            {/* Toggle 3: Cycles & Safety */}
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Session Summaries</Text>
                <Text style={styles.stepperHelper}>Daily activity wrap-up and breaks</Text>
              </View>
              <Switch
                value={notifyCycles}
                onValueChange={setNotifyCycles}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={notifyCycles ? '#FFF' : uiTheme.colors.muted}
              />
            </View>
          </View>

          {/* Section 5: External App Redirects */}
          <View style={styles.sectionCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="open-outline" size={16} color={themeColor} />
              <Text style={styles.sectionHeader}>External App Redirects</Text>
            </View>
            <Text style={styles.sectionDesc}>Choose whether to ask for confirmation before leaving FlirtEasy.</Text>

            {/* Toggle 1: Tinder Confirmation */}
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Ask before opening Tinder</Text>
                <Text style={styles.stepperHelper}>Show confirmation prompt when tapping match alerts</Text>
              </View>
              <Switch
                value={redirectPrefs.tinder === 'always_ask'}
                onValueChange={(val) => {
                  NotificationService.setRedirectPreference('tinder', val ? 'always_ask' : 'auto_open');
                }}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={redirectPrefs.tinder === 'always_ask' ? '#FFF' : uiTheme.colors.muted}
              />
            </View>

            <View style={styles.divider} />

            {/* Toggle 2: WhatsApp Confirmation */}
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Ask before opening WhatsApp</Text>
                <Text style={styles.stepperHelper}>Show confirmation prompt when phone numbers are tapped</Text>
              </View>
              <Switch
                value={redirectPrefs.whatsapp === 'always_ask'}
                onValueChange={(val) => {
                  NotificationService.setRedirectPreference('whatsapp', val ? 'always_ask' : 'auto_open');
                }}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={redirectPrefs.whatsapp === 'always_ask' ? '#FFF' : uiTheme.colors.muted}
              />
            </View>

            <View style={styles.divider} />

            {/* Toggle 3: Instagram Confirmation */}
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Ask before opening Instagram</Text>
                <Text style={styles.stepperHelper}>Show confirmation prompt when social handles are tapped</Text>
              </View>
              <Switch
                value={redirectPrefs.instagram === 'always_ask'}
                onValueChange={(val) => {
                  NotificationService.setRedirectPreference('instagram', val ? 'always_ask' : 'auto_open');
                }}
                trackColor={{ false: uiTheme.colors.elevated, true: themeColor }}
                thumbColor={redirectPrefs.instagram === 'always_ask' ? '#FFF' : uiTheme.colors.muted}
              />
            </View>
          </View>

          {/* Launch Button */}
          <TouchableOpacity accessibilityRole="button"
            style={[styles.launchBtn, { backgroundColor: themeColor }]}
            onPress={handleStartSession}
            activeOpacity={0.85}
          >
            <Text style={[styles.launchBtnText, { color: '#FFF' }]}>
              Open Live Screen
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color="#FFF"
            />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.lg,
    borderBottomWidth: 1,
    borderColor: uiTheme.colors.elevated,
    backgroundColor: uiTheme.colors.surface,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: uiTheme.radius.small,
    backgroundColor: uiTheme.colors.elevated,
  },
  backBtnText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: 'normal',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  title: { fontFamily: 'Manrope_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
  },
  headerSubtitle: { fontFamily: 'Manrope_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginTop: 1,
  },
  scrollContent: { width: '100%', maxWidth: 760, alignSelf: 'center',
    padding: uiTheme.spacing.lg,
    paddingBottom: 36,
  },
  sectionCard: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 16,
    padding: uiTheme.spacing.lg,
    marginBottom: uiTheme.spacing.lg,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: uiTheme.spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  sectionHeader: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    color: '#FFF',
  },
  activePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  activePillText: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  sectionDesc: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: uiTheme.spacing.md,
  },
  goalGrid: {
    gap: uiTheme.spacing.sm,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  goalPillText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  divider: {
    height: 1,
    backgroundColor: '#221E33',
    marginVertical: uiTheme.spacing.md,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: uiTheme.spacing.sm,
  },
  durationPill: {
    flex: 1,
    paddingVertical: uiTheme.spacing.sm,
    borderRadius: uiTheme.radius.small,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPillText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  durationPillTextActive: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  stepperLabel: { fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    fontWeight: 'normal',
    color: '#FFF',
  },
  stepperHelper: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    padding: 3,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: uiTheme.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
    color: '#FFF',
    minWidth: 36,
    textAlign: 'center',
  },
  stepperValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 44,
    justifyContent: 'center',
  },
  stepperUnit: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    marginLeft: 2,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandableContent: {
    marginTop: uiTheme.spacing.md,
    borderTopWidth: 1,
    borderColor: '#221E33',
    paddingTop: uiTheme.spacing.md,
  },
  inputLabel: { fontFamily: 'Inter_600SemiBold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    color: '#A09FB5',
    marginBottom: 6,
  },
  textInput: { fontFamily: 'Inter_400Regular',
    backgroundColor: uiTheme.colors.background,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.sm,
    color: '#FFF',
    fontSize: 12.5,
  },
  textArea: { fontFamily: 'Inter_400Regular',
    backgroundColor: uiTheme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    padding: 10,
    color: '#FFF',
    fontSize: 12.5,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  launchBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    borderRadius: uiTheme.radius.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: uiTheme.spacing.sm,
  },
  launchBtnText: { fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 20, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    marginTop: 14,
  },
  loadingSubtext: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: uiTheme.spacing.xs,
  },
});
