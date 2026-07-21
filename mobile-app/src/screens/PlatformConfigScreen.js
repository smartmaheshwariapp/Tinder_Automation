import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Switch, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';

export default function PlatformConfigScreen({ route, navigation }) {
  const { platform, vpsUrl, proxyIp } = route.params;
  const [loading, setLoading] = useState(false);

  // Cycle settings (Numbers managed by steppers for optimal mobile usability)
  const [likesPerCycle, setLikesPerCycle] = useState(50);
  const [messagesPerCycle, setMessagesPerCycle] = useState(20);
  const [scheduleInterval, setScheduleInterval] = useState(30);

  // AI Prompt settings
  const [useCustomIntro, setUseCustomIntro] = useState(false);
  const [customIntroPrompt, setCustomIntroPrompt] = useState('Hey, I noticed you like... let\'s chat!');

  // Contact details
  const [shareInstagram, setShareInstagram] = useState(false);
  const [instagramValue, setInstagramValue] = useState('');
  
  const [shareWhatsapp, setShareWhatsapp] = useState(false);
  const [whatsappValue, setWhatsappValue] = useState('');

  const [shareTelegram, setShareTelegram] = useState(false);
  const [telegramValue, setTelegramValue] = useState('');

  const increment = (value, setter, step = 5, max = 200) => {
    setter(prev => Math.min(prev + step, max));
  };

  const decrement = (value, setter, step = 5, min = 0) => {
    setter(prev => Math.max(prev - step, min));
  };

  const handleStartSession = async () => {
    setLoading(true);
    // Extract host and protocol dynamically
    let host = 'api.smartmaheshwari.com';
    let protocol = vpsUrl.startsWith('https') ? 'https:' : 'http:';
    try {
      const cleanUrl = vpsUrl.includes('://') ? vpsUrl : 'https://' + vpsUrl;
      const match = cleanUrl.match(/^(https?:)\/\/([^:/]+)/);
      if (match) {
        protocol = match[1];
        host = match[2];
      }
    } catch (e) {}

    const payload = JSON.stringify({ 
      platform: platform.toLowerCase(), 
      userId: 'dev_user_1' 
    });

    let apiHost = host.startsWith('stream.') ? host.replace('stream.', 'api.') : host;
    const urlsToTry = [
      `https://${apiHost}/start-session`,
      `http://${apiHost}:3001/start-session`,
      `https://${apiHost}:3001/start-session`
    ];

    for (const url of urlsToTry) {
      try {
        console.log('[Config] Requesting Neko orchestrator on ' + url);
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
        if (resp.ok) {
          console.log('[Config] Orchestrator responded successfully from ' + url);
          break;
        }
      } catch (err) {}
    }

    const extensionSettings = {
      likesPerCycle,
      messagesPerCycle,
      scheduleInterval,
      customPrompts: {
        useCustomIntro,
        customIntroPrompt,
      },
      contacts: {
        instagram: { enabled: shareInstagram, value: instagramValue },
        whatsapp: { enabled: shareWhatsapp, value: whatsappValue },
        telegram: { enabled: shareTelegram, value: telegramValue },
      }
    };

    // Use configured HTTPS stream domain URL (e.g. https://stream.smartmaheshwari.com)
    const nekoPlayerUrl = (vpsUrl && vpsUrl.includes('://')) 
      ? vpsUrl 
      : `https://${host}/?usr=User&pwd=admin`;

    setLoading(false);
    navigation.navigate('Browser', {
      platform,
      vpsUrl: nekoPlayerUrl,
      proxyIp,
      extensionSettings
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FE3C72" />
          <Text style={styles.loadingText}>Starting Neko Browser...</Text>
          <Text style={styles.loadingSubtext}>Preloading extension & preparing session volume</Text>
        </View>
      )}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{platform} Setup</Text>
          <View style={{ width: 70 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.pageTitle}>Automation Preferences</Text>
          <Text style={styles.pageSubtitle}>Configure how the FlirtEasy swiper runs inside your virtual browser session.</Text>

          {/* Section 1: Cycle Controls (Stepper Mode) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Cycle Limits</Text>
            <Text style={styles.sectionDesc}>Control how active the auto-swiper runs per interval batch to stay safe.</Text>

            {/* Likes Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Likes / Batch</Text>
                <Text style={styles.stepperHelper}>Profiles swiped per cycle</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => decrement(likesPerCycle, setLikesPerCycle, 10, 0)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{likesPerCycle}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => increment(likesPerCycle, setLikesPerCycle, 10, 200)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Messages Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Messages / Batch</Text>
                <Text style={styles.stepperHelper}>AI intros sent per cycle</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => decrement(messagesPerCycle, setMessagesPerCycle, 5, 0)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{messagesPerCycle}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => increment(messagesPerCycle, setMessagesPerCycle, 5, 100)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Interval Stepper */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.stepperLabel}>Cycle Interval</Text>
                <Text style={styles.stepperHelper}>Delay between batches</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => decrement(scheduleInterval, setScheduleInterval, 5, 5)}>
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>
                <View style={styles.stepperValueWrapper}>
                  <Text style={styles.stepperValue}>{scheduleInterval}</Text>
                  <Text style={styles.stepperUnit}>min</Text>
                </View>
                <TouchableOpacity style={styles.stepBtn} onPress={() => increment(scheduleInterval, setScheduleInterval, 5, 1440)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 2: AI Settings */}
          <View style={styles.sectionCard}>
            <View style={styles.toggleHeaderRow}>
              <View style={styles.stepperTextContainer}>
                <Text style={styles.sectionHeader}>Custom AI Agent Prompts</Text>
                <Text style={styles.sectionDesc}>Customize the AI wingman personality template.</Text>
              </View>
              <Switch
                value={useCustomIntro}
                onValueChange={setUseCustomIntro}
                trackColor={{ false: '#2A2A35', true: '#FE3C72' }}
                thumbColor={useCustomIntro ? '#FFF' : '#8E8E9F'}
              />
            </View>

            {useCustomIntro && (
              <View style={styles.expandableContent}>
                <Text style={styles.inputLabel}>Custom Intro prompt directive</Text>
                <TextInput
                  style={styles.textArea}
                  value={customIntroPrompt}
                  onChangeText={setCustomIntroPrompt}
                  multiline={true}
                  placeholder="Tell the AI wingman how to compose the first message..."
                  placeholderTextColor="#555"
                  numberOfLines={4}
                />
              </View>
            )}
          </View>

          {/* Section 3: Contact Sharing (Off-App) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Off-App Auto Sharing</Text>
            <Text style={styles.sectionDesc}>Automatically transition high-value matches to your socials.</Text>

            {/* Instagram Linker */}
            <View style={styles.contactContainer}>
              <View style={styles.contactToggleRow}>
                <Text style={styles.contactName}>Instagram Username</Text>
                <Switch
                  value={shareInstagram}
                  onValueChange={setShareInstagram}
                  trackColor={{ false: '#2A2A35', true: '#FE3C72' }}
                  thumbColor={shareInstagram ? '#FFF' : '#8E8E9F'}
                />
              </View>
              {shareInstagram && (
                <TextInput
                  style={styles.textInput}
                  placeholder="@username"
                  placeholderTextColor="#666"
                  value={instagramValue}
                  onChangeText={setInstagramValue}
                  autoCapitalize="none"
                />
              )}
            </View>

            {/* WhatsApp Linker */}
            <View style={styles.contactContainer}>
              <View style={styles.contactToggleRow}>
                <Text style={styles.contactName}>WhatsApp Business Phone</Text>
                <Switch
                  value={shareWhatsapp}
                  onValueChange={setShareWhatsapp}
                  trackColor={{ false: '#2A2A35', true: '#FE3C72' }}
                  thumbColor={shareWhatsapp ? '#FFF' : '#8E8E9F'}
                />
              </View>
              {shareWhatsapp && (
                <TextInput
                  style={styles.textInput}
                  placeholder="+1 (234) 567-8900"
                  placeholderTextColor="#666"
                  value={whatsappValue}
                  onChangeText={setwhatsappValue => setWhatsappValue(whatsappValue)}
                  keyboardType="phone-pad"
                />
              )}
            </View>

            {/* Telegram Linker */}
            <View style={styles.contactContainer}>
              <View style={styles.contactToggleRow}>
                <Text style={styles.contactName}>Telegram Handle</Text>
                <Switch
                  value={shareTelegram}
                  onValueChange={setShareTelegram}
                  trackColor={{ false: '#2A2A35', true: '#FE3C72' }}
                  thumbColor={shareTelegram ? '#FFF' : '#8E8E9F'}
                />
              </View>
              {shareTelegram && (
                <TextInput
                  style={styles.textInput}
                  placeholder="@telegram_handle"
                  placeholderTextColor="#666"
                  value={telegramValue}
                  onChangeText={setTelegramValue}
                  autoCapitalize="none"
                />
              )}
            </View>
          </View>

          {/* Launch Gradient Button */}
          <TouchableOpacity style={styles.launchBtn} onPress={handleStartSession}>
            <Text style={styles.launchBtnText}>Launch Automation Session</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
  },
  header: {
    height: 56,
    marginTop: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#1C1C24',
    backgroundColor: '#111116',
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E1E26',
  },
  backBtnText: {
    color: '#8E8E9F',
    fontSize: 13,
    fontWeight: 'bold',
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#8E8E9F',
    lineHeight: 18,
    marginBottom: 25,
  },
  sectionCard: {
    backgroundColor: '#111116',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1C1C24',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#6E6E7F',
    lineHeight: 16,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#1C1C24',
    marginVertical: 15,
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E0E0E6',
  },
  stepperHelper: {
    fontSize: 11,
    color: '#6E6E7F',
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A22',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#242432',
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#262636',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    minWidth: 40,
    textAlign: 'center',
  },
  stepperValueWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 50,
    justifyContent: 'center',
  },
  stepperUnit: {
    fontSize: 10,
    color: '#6E6E7F',
    marginLeft: 2,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandableContent: {
    marginTop: 15,
    borderTopWidth: 1,
    borderColor: '#1C1C24',
    paddingTop: 15,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FE3C72',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#0A0A0E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242432',
    color: '#FFF',
    padding: 14,
    fontSize: 14,
    height: 90,
    textAlignVertical: 'top',
    lineHeight: 18,
  },
  contactContainer: {
    marginBottom: 12,
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F1F2C',
  },
  contactToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E0E0E6',
  },
  textInput: {
    backgroundColor: '#0A0A0E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242432',
    color: '#FFF',
    padding: 10,
    fontSize: 13,
    marginTop: 12,
  },
  launchBtn: {
    backgroundColor: '#FE3C72',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  launchBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 14, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  loadingSubtext: {
    color: '#8E8E9F',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
