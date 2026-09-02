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
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { resolveLocalUrl } from '../utils/network';
import { terminatePreviousSessions, registerActiveSession, startHyperbeamCloudSession, startOnDeviceSession } from '../utils/sessionManager';
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
  const [sessionDuration, setSessionDuration] = useState(30); // 15 | 30 | 45 | 60 | 0 (continuous)
  const [likesPerCycle, setLikesPerCycle] = useState(50);
  const [messagesPerCycle, setMessagesPerCycle] = useState(20);
  const [scheduleInterval, setScheduleInterval] = useState(30);

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

    const isLocalDevice = route.params?.isLocalDevice || route.params?.environment === 'on_device';
    if (isLocalDevice) {
      try {
        console.log('[Mobile] Starting On-Device Local Session...');
        const { targetUrl } = await startOnDeviceSession({
          platform,
          duration: sessionDuration,
        });
        setLoading(false);
        navigation.navigate('Browser', {
          platform,
          vpsUrl: targetUrl,
          isLocalDevice: true,
          environment: 'on_device',
          sessionDuration,
          proxyIp: '',
        });
        return;
      } catch (devErr) {
        console.error('[Mobile] On-device startup error:', devErr);
      }
    }

    const isHyperbeam = vpsUrl === 'hyperbeam' || route.params?.environment === 'hyperbeam';

    // Desktop Web View resolution (1280x720) so full website Login buttons are visible
    const webWidth = 1280;
    const webHeight = 720;
    console.log(`[Mobile] Desktop Web View Resolution: ${webWidth}x${webHeight}`);

    if (isHyperbeam) {
      try {
        console.log('[Mobile] Starting Hyperbeam Cloud Browser session...');
        const realProxy = proxyIp === 'http://*****:*****@46.203.181.164:43343'
          ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
          : proxyIp;

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
          orchestratorUrl: resolvedOrchestratorUrl,
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

  const themeColor = platform.toLowerCase() === 'tinder' ? '#FE3C72' : '#FFB800';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0B14" />
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color="#D8D6E8" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>{platform} Launch Setup</Text>
            <Text style={[styles.headerSubtitle, { color: themeColor }]}>Linksy V2 Engine</Text>
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
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalPill, selectedGoal === goal.id && { borderColor: themeColor, backgroundColor: themeColor + '12' }]}
                  onPress={() => setSelectedGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={goal.icon}
                    size={14}
                    color={selectedGoal === goal.id ? themeColor : '#8E8DA3'}
                  />
                  <Text style={[styles.goalPillText, selectedGoal === goal.id && { color: '#FFF', fontWeight: '700' }]}>
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
                  placeholderTextColor="#7A7990"
                  value={contactHandle}
                  onChangeText={setContactHandle}
                  autoCapitalize="none"
                />
              </View>
            )}
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
                <TouchableOpacity style={styles.stepBtn} onPress={() => decrement(likesPerCycle, setLikesPerCycle, 10, 0)}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{likesPerCycle}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => increment(likesPerCycle, setLikesPerCycle, 10, 200)}>
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
                <TouchableOpacity style={styles.stepBtn} onPress={() => decrement(messagesPerCycle, setMessagesPerCycle, 5, 0)}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{messagesPerCycle}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => increment(messagesPerCycle, setMessagesPerCycle, 5, 100)}>
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
                <TouchableOpacity style={styles.stepBtn} onPress={() => decrement(scheduleInterval, setScheduleInterval, 5, 5)}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.stepperValueWrapper}>
                  <Text style={styles.stepperValue}>{scheduleInterval}</Text>
                  <Text style={styles.stepperUnit}>min</Text>
                </View>
                <TouchableOpacity style={styles.stepBtn} onPress={() => increment(scheduleInterval, setScheduleInterval, 5, 1440)}>
                  <Feather name="plus" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 2.5: Automation Duration / Session Timer */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="timer-outline" size={16} color={themeColor} />
                <Text style={styles.sectionHeader}>Session Duration</Text>
              </View>
              <View style={[styles.activePill, { backgroundColor: `${themeColor}20`, borderColor: themeColor }]}>
                <Text style={[styles.activePillText, { color: themeColor }]}>
                  {sessionDuration === 0 ? 'Continuous' : `${sessionDuration} min auto-stop`}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>
              Automatically pause swiping when time is up to protect account safety and save battery.
            </Text>

            <View style={styles.timerDurationGrid}>
              {[
                { label: '15 min', value: 15 },
                { label: '30 min', value: 30, recommended: true },
                { label: '45 min', value: 45 },
                { label: '60 min', value: 60 },
                { label: 'Non-stop', value: 0 },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.timerChip,
                    sessionDuration === item.value && [styles.timerChipActive, { borderColor: themeColor, backgroundColor: `${themeColor}15` }],
                  ]}
                  onPress={() => setSessionDuration(item.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timerChipText, sessionDuration === item.value && { color: '#FFF', fontWeight: '700' }]}>
                    {item.label}
                  </Text>
                  {item.recommended && (
                    <Text style={[styles.timerChipBadge, { color: themeColor }]}>Rec</Text>
                  )}
                </TouchableOpacity>
              ))}
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={useCustomIntro ? '#FFF' : '#7A7990'}
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
                  placeholderTextColor="#7A7990"
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={notifyGoals ? '#FFF' : '#7A7990'}
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={notifyMatches ? '#FFF' : '#7A7990'}
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={notifyCycles ? '#FFF' : '#7A7990'}
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={redirectPrefs.tinder === 'always_ask' ? '#FFF' : '#7A7990'}
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={redirectPrefs.whatsapp === 'always_ask' ? '#FFF' : '#7A7990'}
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
                trackColor={{ false: '#26223B', true: themeColor }}
                thumbColor={redirectPrefs.instagram === 'always_ask' ? '#FFF' : '#7A7990'}
              />
            </View>
          </View>

          {/* Launch Button */}
          <TouchableOpacity
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
    backgroundColor: '#0D0B14',
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#26223B',
    backgroundColor: '#161424',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#26223B',
  },
  backBtnText: {
    color: '#D8D6E8',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  sectionCard: {
    backgroundColor: '#161424',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  activePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#8E8DA3',
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 12,
  },
  goalGrid: {
    gap: 8,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D0B14',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  goalPillText: {
    color: '#8E8DA3',
    fontSize: 12.5,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#221E33',
    marginVertical: 12,
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
  stepperLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFF',
  },
  stepperHelper: {
    fontSize: 11,
    color: '#716E89',
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  timerDurationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D0B14',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  timerChipActive: {
    borderWidth: 1.5,
  },
  timerChipText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '600',
  },
  timerChipBadge: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#26223B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '700',
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
  stepperUnit: {
    fontSize: 10,
    color: '#716E89',
    marginLeft: 2,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandableContent: {
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: '#221E33',
    paddingTop: 12,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#A09FB5',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26223B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 12.5,
  },
  textArea: {
    backgroundColor: '#0D0B14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 10,
    color: '#FFF',
    fontSize: 12.5,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  launchBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  launchBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 20, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
  },
  loadingSubtext: {
    color: '#716E89',
    fontSize: 12,
    marginTop: 4,
  },
});
