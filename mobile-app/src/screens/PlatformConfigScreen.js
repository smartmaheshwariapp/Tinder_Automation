import { theme as uiTheme, alpha } from '../theme';
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
import useResponsive from '../hooks/useResponsive';
import { AppText, AppButton, Card, ListRow, SectionHeader, IconButton, Badge, FadeIn } from '../components/ui';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Feature Flags (Hidden to avoid duplicating V2 Automation Panel) ───
const SHOW_DUPLICATE_AUTOMATION_SECTIONS = false;

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
  const { gutter } = useResponsive();

  // V2 Dating Goal & Contact Handle
  const [selectedGoal, setSelectedGoal] = useState('date');
  const [contactHandle, setContactHandle] = useState('');

  // Cycle settings
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

    const isOnDevice = vpsUrl === 'on_device' || route.params?.environment === 'on_device';
    const isHyperbeam = vpsUrl === 'hyperbeam' || route.params?.environment === 'hyperbeam';

    if (isOnDevice) {
      setLoading(false);
      navigation.navigate('Browser', {
        platform,
        vpsUrl: 'https://tinder.com',
        isOnDevice: true,
        environment: 'on_device',
        extensionSettings: {
          ...getSharedExtensionSettings(),
          ...(SHOW_DUPLICATE_AUTOMATION_SECTIONS ? {
            likesPerCycle,
            messagesPerCycle,
            selectedGoal,
            contactHandle,
            customIntroPrompt,
            useCustomIntro,
          } : {})
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

  const themeColor = platform.toLowerCase() === 'tinder' ? uiTheme.colors.primary : uiTheme.colors.warning;

  const alertsOn = [notifyGoals, notifyMatches, notifyCycles].filter(Boolean).length;
  const asksBefore = ['tinder', 'whatsapp', 'instagram'].filter((key) => redirectPrefs?.[key] === 'always_ask').length;

  const switchProps = (value) => ({
    trackColor: { false: uiTheme.colors.elevatedHigh, true: themeColor },
    thumbColor: value ? uiTheme.colors.onPrimary : uiTheme.colors.muted,
    ios_backgroundColor: uiTheme.colors.elevatedHigh,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={uiTheme.colors.background} />
      {loading && (
        <View style={styles.loadingOverlay} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <FadeIn style={styles.loadingInner}>
            <View style={styles.loadingWell}>
              <ActivityIndicator size="large" color={themeColor} />
            </View>
            <AppText variant="section" align="center" style={styles.loadingText}>Initializing Session...</AppText>
            <AppText variant="callout" color="muted" align="center" style={styles.loadingSubtext}>Connecting to browser container</AppText>
          </FadeIn>
        </View>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <IconButton icon="chevron-back" variant="plain" iconSize={26} onPress={() => navigation.goBack()} accessibilityLabel="Go back" style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: gutter, paddingBottom: FOOTER_SPACE }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          <FadeIn style={styles.titleBlock}>
            <AppText variant="largeTitle" numberOfLines={2}>{platform} Preferences</AppText>
            <AppText variant="body" color="muted" style={styles.titleSub}>Alerts and app shortcuts for your live session.</AppText>
          </FadeIn>

          {/* Session summary */}
          <FadeIn delay={40}>
            <View style={styles.hero}>
              <LinearGradient
                colors={[alpha(themeColor, 0.28), alpha(uiTheme.colors.secondary, 0.1), alpha(uiTheme.colors.surface, 0)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="flame" size={140} color={alpha(uiTheme.colors.white, 0.05)} style={styles.heroMark} />
              <View style={styles.heroTop}>
                <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroLogo}>
                  <Ionicons name="flame" size={26} color={uiTheme.colors.onPrimary} />
                </LinearGradient>
                <View style={styles.heroCopy}>
                  <AppText variant="section" numberOfLines={1}>Ready when you are</AppText>
                  <AppText variant="footnote" color="textSecondary">Review your alerts, then open the live {platform} screen.</AppText>
                </View>
              </View>
              <View style={styles.heroChips}>
                <Badge label={`${alertsOn} of 3 alerts on`} tone={alertsOn ? 'success' : 'neutral'} icon="notifications" />
                <Badge label={asksBefore ? `Asks before ${asksBefore} app${asksBefore === 1 ? '' : 's'}` : 'Opens apps directly'} tone="secondary" icon="open-outline" />
              </View>
            </View>
          </FadeIn>

          {SHOW_DUPLICATE_AUTOMATION_SECTIONS && (
            <>
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
                      accessibilityLabel={goal.label}
                      accessibilityState={{ selected: selectedGoal === goal.id }}
                      style={[styles.goalPill, selectedGoal === goal.id && { borderColor: themeColor, backgroundColor: alpha(themeColor, 0.08) }]}
                      onPress={() => setSelectedGoal(goal.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={goal.icon}
                        size={16}
                        color={selectedGoal === goal.id ? themeColor : uiTheme.colors.muted}
                      />
                      <Text style={[styles.goalPillText, selectedGoal === goal.id && styles.goalPillTextSelected]}>
                        {goal.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {selectedGoal !== 'never' && (
                  <View style={{ marginTop: uiTheme.spacing.md }}>
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

              {/* Section 2: Daily Pacing */}
              <View style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="speedometer-outline" size={16} color={themeColor} />
                    <Text style={styles.sectionHeader}>Daily Pacing & Safety</Text>
                  </View>
                  <View style={[styles.activePill, { backgroundColor: alpha(themeColor, 0.1), borderColor: alpha(themeColor, 0.25) }]}>
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
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease likes per session" style={styles.stepBtn} onPress={() => decrement(likesPerCycle, setLikesPerCycle, 10, 0)}>
                      <Feather name="minus" size={14} color={uiTheme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{likesPerCycle}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase likes per session" style={styles.stepBtn} onPress={() => increment(likesPerCycle, setLikesPerCycle, 10, 200)}>
                      <Feather name="plus" size={14} color={uiTheme.colors.text} />
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
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease intro messages per session" style={styles.stepBtn} onPress={() => decrement(messagesPerCycle, setMessagesPerCycle, 5, 0)}>
                      <Feather name="minus" size={14} color={uiTheme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{messagesPerCycle}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase intro messages per session" style={styles.stepBtn} onPress={() => increment(messagesPerCycle, setMessagesPerCycle, 5, 100)}>
                      <Feather name="plus" size={14} color={uiTheme.colors.text} />
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
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease break between sessions" style={styles.stepBtn} onPress={() => decrement(scheduleInterval, setScheduleInterval, 5, 5)}>
                      <Feather name="minus" size={14} color={uiTheme.colors.text} />
                    </TouchableOpacity>
                    <View style={styles.stepperValueWrapper}>
                      <Text style={styles.stepperValue}>{scheduleInterval}</Text>
                      <Text style={styles.stepperUnit}>min</Text>
                    </View>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase break between sessions" style={styles.stepBtn} onPress={() => increment(scheduleInterval, setScheduleInterval, 5, 1440)}>
                      <Feather name="plus" size={14} color={uiTheme.colors.text} />
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
                    accessibilityLabel="Custom first message"
                    {...switchProps(useCustomIntro)}
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
            </>
          )}

          {/* Section 4: Push Notification Preferences */}
          <FadeIn delay={80}>
            <SectionHeader title="Alerts" description="Choose which updates reach your phone." style={styles.sectionHeaderGap} />
            <Card padding="none" style={styles.groupCard}>
              {/* Toggle 1: Goal Alerts */}
              <ListRow
                icon="trophy-outline"
                iconTone="secondary"
                title="Milestones & Phone Numbers"
                subtitle="Get notified when a match shares their phone or date"
                divider
                right={
                  <Switch
                    value={notifyGoals}
                    onValueChange={setNotifyGoals}
                    accessibilityLabel="Milestones and phone number alerts"
                    {...switchProps(notifyGoals)}
                  />
                }
              />
              {/* Toggle 2: New Match Sparks */}
              <ListRow
                icon="heart-outline"
                title="New Matches"
                subtitle="Get notified when someone matches with you"
                divider
                right={
                  <Switch
                    value={notifyMatches}
                    onValueChange={setNotifyMatches}
                    accessibilityLabel="New match alerts"
                    {...switchProps(notifyMatches)}
                  />
                }
              />
              {/* Toggle 3: Cycles & Safety */}
              <ListRow
                icon="stats-chart-outline"
                iconTone="info"
                title="Session Summaries"
                subtitle="Daily activity wrap-up and breaks"
                right={
                  <Switch
                    value={notifyCycles}
                    onValueChange={setNotifyCycles}
                    accessibilityLabel="Session summary alerts"
                    {...switchProps(notifyCycles)}
                  />
                }
              />
            </Card>
          </FadeIn>

          {/* Section 5: External App Redirects */}
          <FadeIn delay={120}>
            <SectionHeader title="Leaving Flint" description="Ask before a tap opens another app." style={styles.sectionHeaderGap} />
            <Card padding="none" style={styles.groupCard}>
              {/* Toggle 1: Tinder Confirmation */}
              <ListRow
                icon="flame-outline"
                title="Ask before opening Tinder"
                subtitle="Show confirmation prompt when tapping match alerts"
                divider
                right={
                  <Switch
                    value={redirectPrefs.tinder === 'always_ask'}
                    onValueChange={(val) => {
                      NotificationService.setRedirectPreference('tinder', val ? 'always_ask' : 'auto_open');
                    }}
                    accessibilityLabel="Ask before opening Tinder"
                    {...switchProps(redirectPrefs.tinder === 'always_ask')}
                  />
                }
              />
              {/* Toggle 2: WhatsApp Confirmation */}
              <ListRow
                icon="logo-whatsapp"
                iconTone="success"
                title="Ask before opening WhatsApp"
                subtitle="Show confirmation prompt when phone numbers are tapped"
                divider
                right={
                  <Switch
                    value={redirectPrefs.whatsapp === 'always_ask'}
                    onValueChange={(val) => {
                      NotificationService.setRedirectPreference('whatsapp', val ? 'always_ask' : 'auto_open');
                    }}
                    accessibilityLabel="Ask before opening WhatsApp"
                    {...switchProps(redirectPrefs.whatsapp === 'always_ask')}
                  />
                }
              />
              {/* Toggle 3: Instagram Confirmation */}
              <ListRow
                icon="logo-instagram"
                iconTone="info"
                title="Ask before opening Instagram"
                subtitle="Show confirmation prompt when social handles are tapped"
                right={
                  <Switch
                    value={redirectPrefs.instagram === 'always_ask'}
                    onValueChange={(val) => {
                      NotificationService.setRedirectPreference('instagram', val ? 'always_ask' : 'auto_open');
                    }}
                    accessibilityLabel="Ask before opening Instagram"
                    {...switchProps(redirectPrefs.instagram === 'always_ask')}
                  />
                }
              />
            </Card>
          </FadeIn>
        </ScrollView>

        {/* Launch Button (sticky footer above the home indicator) */}
        <View style={[styles.footer, { paddingBottom: uiTheme.spacing.lg, paddingHorizontal: gutter }]} pointerEvents="box-none">
          <LinearGradient
            pointerEvents="none"
            colors={[alpha(uiTheme.colors.background, 0), uiTheme.colors.background]}
            style={styles.footerFade}
          />
          <AppButton
            title="Open Live Screen"
            icon="flame"
            iconRight="arrow-forward"
            onPress={handleStartSession}
            loading={loading}
            style={styles.launchBtn}
          />
          <AppText variant="footnote" color="muted" align="center" style={styles.footerNote}>
            Opens {platform} in a secure live screen
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Height reserved at the bottom of the scroll content so the sticky footer never covers it.
const FOOTER_SPACE = uiTheme.layout.buttonHeight + uiTheme.spacing.section + uiTheme.spacing.xxl + uiTheme.spacing.lg;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  header: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax + 64,
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  backButton: {
    marginLeft: -uiTheme.spacing.md,
  },
  scrollContent: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax + 64,
    alignSelf: 'center',
    paddingTop: uiTheme.spacing.xs,
  },
  titleBlock: {
    marginBottom: uiTheme.spacing.xl,
  },
  titleSub: {
    marginTop: uiTheme.spacing.xs,
  },
  hero: {
    borderRadius: uiTheme.radius.xl,
    borderWidth: 1,
    borderColor: uiTheme.colors.primaryBorder,
    backgroundColor: uiTheme.colors.surface,
    padding: uiTheme.spacing.lg,
    gap: uiTheme.spacing.lg,
    overflow: 'hidden',
    marginBottom: uiTheme.spacing.section,
    ...uiTheme.shadows.md,
  },
  heroMark: {
    position: 'absolute',
    right: -24,
    bottom: -30,
    transform: [{ rotate: '-12deg' }],
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
  },
  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...uiTheme.shadows.glow,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
  },
  sectionHeaderGap: {
    marginBottom: uiTheme.spacing.sm,
  },
  groupCard: {
    overflow: 'hidden',
    marginBottom: uiTheme.spacing.xxl,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: uiTheme.spacing.sm,
    backgroundColor: uiTheme.colors.background,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -28,
    height: 28,
  },
  footerNote: {
    marginTop: uiTheme.spacing.sm,
  },
  launchBtn: {
    width: '100%',
    maxWidth: uiTheme.layout.formMax,
    alignSelf: 'center',
  },
  // ─── Hidden (feature-flagged) automation sections ───
  sectionCard: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    padding: uiTheme.spacing.lg,
    marginBottom: uiTheme.spacing.lg,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
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
  sectionHeader: {
    ...uiTheme.type.headline,
    color: uiTheme.colors.text,
  },
  activePill: {
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
    borderRadius: uiTheme.radius.xs,
    borderWidth: 1,
  },
  activePillText: {
    ...uiTheme.type.caption,
    fontFamily: uiTheme.fonts.strong,
  },
  sectionDesc: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
    marginTop: uiTheme.spacing.xxs,
    marginBottom: uiTheme.spacing.md,
  },
  goalGrid: {
    gap: uiTheme.spacing.sm,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    minHeight: uiTheme.layout.touchTarget,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.md,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
  },
  goalPillText: {
    ...uiTheme.type.subhead,
    color: uiTheme.colors.muted,
  },
  goalPillTextSelected: {
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: uiTheme.colors.divider,
    marginVertical: uiTheme.spacing.md,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperTextContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: uiTheme.spacing.md,
  },
  stepperLabel: {
    ...uiTheme.type.label,
    color: uiTheme.colors.text,
  },
  stepperHelper: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
    marginTop: uiTheme.spacing.xxs,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.md,
    padding: uiTheme.spacing.xxs,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: uiTheme.radius.sm,
    backgroundColor: uiTheme.colors.elevatedHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    ...uiTheme.type.label,
    fontFamily: uiTheme.fonts.strong,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.text,
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
    ...uiTheme.type.caption,
    color: uiTheme.colors.muted,
    marginLeft: uiTheme.spacing.xxs,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandableContent: {
    marginTop: uiTheme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: uiTheme.colors.divider,
    paddingTop: uiTheme.spacing.md,
  },
  inputLabel: {
    ...uiTheme.type.label,
    color: uiTheme.colors.textSecondary,
    marginBottom: uiTheme.spacing.sm,
  },
  textInput: {
    ...uiTheme.type.callout,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    minHeight: uiTheme.layout.inputHeight,
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: uiTheme.spacing.sm,
    color: uiTheme.colors.text,
  },
  textArea: {
    ...uiTheme.type.callout,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    padding: uiTheme.spacing.md,
    color: uiTheme.colors.text,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  // ─── Loading overlay ───
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(uiTheme.colors.background, 0.96),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: uiTheme.spacing.xxl,
    zIndex: 999,
  },
  loadingInner: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  loadingWell: {
    width: 72,
    height: 72,
    borderRadius: uiTheme.radius.xl,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: uiTheme.spacing.lg,
  },
  loadingSubtext: {
    marginTop: uiTheme.spacing.xs,
  },
});
