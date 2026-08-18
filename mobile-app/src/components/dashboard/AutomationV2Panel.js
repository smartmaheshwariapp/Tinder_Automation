// src/components/dashboard/AutomationV2Panel.js — Comprehensive FlirtEasy V2 Panel with Style Training & Safety Controls
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Goal Options ───
const GOAL_OPTIONS = [
  { id: 'date', label: 'Set up a Date', desc: 'Propose coffee, drinks, dinner or activity', icon: 'calendar-outline' },
  { id: 'phone', label: 'Get Phone Number / WhatsApp', desc: 'Move conversation to WhatsApp or SMS', icon: 'logo-whatsapp' },
  { id: 'instagram', label: 'Get Social Media', desc: 'Exchange Instagram handles and socials', icon: 'logo-instagram' },
  { id: 'move_to_telegram', label: 'Move to Telegram', desc: 'Direct match to your Telegram username', icon: 'paper-plane-outline' },
  { id: 'move_to_instagram', label: 'Move to Instagram (Pitch)', desc: 'Pitch your IG profile handle directly', icon: 'camera-outline' },
  { id: 'move_to_tango', label: 'Move to Tango', desc: 'Direct contact transition to Tango', icon: 'call-outline' },
  { id: 'never', label: 'Keep Engaging', desc: 'Continuous natural AI conversation on-app', icon: 'infinite-outline' },
];

const TONE_OPTIONS = ['Playful', 'Flirty', 'Direct', 'Casual', 'Romantic', 'Intellectual'];
const DATE_GOALS = ['coffee', 'drinks', 'dinner', 'activity'];
const GENDER_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];
const ACTIVE_HOUR_PRESETS = ['24/7', 'Day (9am-10pm)', 'Evening (6pm-12am)', 'Custom'];
const REPLY_LENGTHS = [
  { id: 'short', label: 'Short & Punchy' },
  { id: 'medium', label: 'Balanced' },
  { id: 'long', label: 'Detailed' },
];
const EMOJI_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'subtle', label: 'Subtle (1-2)' },
  { id: 'expressive', label: 'Expressive' },
];

// Interactive Training Personas
const TRAINING_PERSONA = {
  name: 'Mia',
  opener: "hey! your profile actually made me stop scrolling 👀 what do you do for fun?",
  replies: [
    "haha no way, that's awesome! what's the next thing on your bucket list?",
    "lol i love that energy. what are you usually up to on weekends?",
    "okay i like your vibe honestly 😊 what's your ideal first date?",
  ]
};

export default function AutomationV2Panel({ settings, loading, saving, saveSuccess, error, onSave }) {
  const [form, setForm] = useState(null);

  // Accordion open states (all collapsed by default)
  const [openCards, setOpenCards] = useState({
    goal: false,
    swiping: false,
    messaging: false,
    style: false,
    activeTime: false,
  });

  // Chat Style Training Simulator State
  const [trainingActive, setTrainingActive] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputPracticeMsg, setInputPracticeMsg] = useState('');
  const [calibrating, setCalibrating] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  const toggleCard = (cardKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

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
      onSave(form);
    }
  };

  // ─── Chat Style Trainer Logic ───
  const startTrainingSession = () => {
    setTrainingActive(true);
    setChatMessages([
      { id: '1', sender: 'mia', text: TRAINING_PERSONA.opener }
    ]);
  };

  const sendPracticeMessage = () => {
    if (!inputPracticeMsg.trim()) return;
    const userText = inputPracticeMsg.trim();
    setInputPracticeMsg('');
    const newMsgs = [...chatMessages, { id: String(Date.now()), sender: 'user', text: userText }];
    setChatMessages(newMsgs);

    // Mia responds after 800ms
    setCalibrating(true);
    setTimeout(() => {
      const replyIdx = Math.min(newMsgs.filter(m => m.sender === 'user').length - 1, TRAINING_PERSONA.replies.length - 1);
      const replyText = TRAINING_PERSONA.replies[replyIdx] || "okay i definitely have your texting cadence locked in now!";
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), sender: 'mia', text: replyText }]);
      setCalibrating(false);
    }, 800);
  };

  if (loading || !form) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="small" color="#FE3C72" />
        <Text style={styles.loadingText}>Syncing Automation V2 configuration...</Text>
      </View>
    );
  }

  // ─── Collapsed Summary Chip Generators ───
  const getGoalSummary = () => {
    const goalObj = GOAL_OPTIONS.find(g => g.id === form.goal) || GOAL_OPTIONS[0];
    const subActivity = form.goal === 'date' ? ` (${form.datesetupGoal || 'coffee'})` : '';
    return `${goalObj.label}${subActivity}`;
  };

  const getContactSummary = () => {
    if (form.contactDetails?.whatsapp?.value) return `WA: ${form.contactDetails.whatsapp.value}`;
    if (form.contactDetails?.instagram?.value) return `IG: @${form.contactDetails.instagram.value.replace('@', '')}`;
    if (form.contactDetails?.telegram?.value) return `TG: @${form.contactDetails.telegram.value.replace('@', '')}`;
    return 'No handle set';
  };

  const getSwipingSummary = () => {
    const likes = `${form.likesPerCycle ?? 50} Likes/batch`;
    const pacing = `${form.scheduleInterval ?? 30}m Cooldown`;
    const age = form.ageFilter?.enabled ? `Age: ${form.ageFilter?.min ?? 20}-${form.ageFilter?.max ?? 35}` : 'Age: All';
    return { likes, pacing, age };
  };

  const getMessagingSummary = () => {
    const tone = `${form.tone || 'Playful'} Tone`;
    const followup = `${form.promptModes?.followup?.delay || '24'}h Follow-up`;
    return { tone, followup };
  };

  const getStyleSummary = () => {
    const gender = `Gender: ${(form.userGenderOverride || 'Auto').toUpperCase()}`;
    const length = REPLY_LENGTHS.find(r => r.id === form.replyLength)?.label || 'Balanced';
    return { gender, length };
  };

  const getActiveTimeSummary = () => {
    if (form.activeHours?.enabled === false) return '24/7 Run (Always Active)';
    return `${form.activeHours?.preset || '24/7'}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ════════════════════ CARD 1: YOUR DATING GOAL ════════════════════ */}
        <View style={[styles.v2Card, openCards.goal && styles.v2CardOpen]}>
          <TouchableOpacity
            style={styles.v2CardHeader}
            onPress={() => toggleCard('goal')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="flag-outline" size={17} color="#FE3C72" />
              <Text style={styles.v2CardTitle}>Your Dating Goal</Text>
            </View>
            <Ionicons
              name={openCards.goal ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8E8DA3"
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.goal && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="locate" size={11} color="#FE3C72" />
                <Text style={styles.v2ChipText}>{getGoalSummary()}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="chatbox" size={11} color="#EC4899" />
                <Text style={styles.v2ChipText}>{getContactSummary()}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>Pace: {form.moveOffAppMinMessages ?? 3}-{form.moveOffAppMaxMessages ?? 8} msgs</Text>
              </View>
            </View>
          )}

          {/* Expanded Card Body */}
          {openCards.goal && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Select how the AI Wingman steers and closes conversations:</Text>

              {/* Goal Radio Group */}
              <View style={styles.radioGroup}>
                {GOAL_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.goalOption, form.goal === opt.id && styles.goalOptionSelected]}
                    onPress={() => updateField('goal', opt.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioCircle, form.goal === opt.id && styles.radioCircleActive]}>
                      {form.goal === opt.id && <View style={styles.radioInnerCircle} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={opt.icon} size={14} color={form.goal === opt.id ? '#FE3C72' : '#8E8DA3'} />
                        <Text style={[styles.goalOptionLabel, form.goal === opt.id && { color: '#FFF' }]}>{opt.label}</Text>
                      </View>
                      <Text style={styles.goalOptionSub}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date Setup Sub-Activity Choice */}
              {form.goal === 'date' && (
                <View style={styles.subBox}>
                  <Text style={styles.subBoxTitle}>Date Activity Type</Text>
                  <View style={styles.chipRow}>
                    {DATE_GOALS.map(dg => (
                      <TouchableOpacity
                        key={dg}
                        style={[styles.chip, form.datesetupGoal === dg && styles.chipActive]}
                        onPress={() => updateField('datesetupGoal', dg)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, form.datesetupGoal === dg && styles.chipTextActive]}>
                          {dg.charAt(0).toUpperCase() + dg.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Contact Details Inputs */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Off-App Contact Details (Pitched to match)</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>WhatsApp / Phone Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="+1 (234) 567-8900"
                    placeholderTextColor="#55526B"
                    value={form.contactDetails?.whatsapp?.value || ''}
                    onChangeText={val => updateField('contactDetails.whatsapp.value', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Instagram Handle</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="@username"
                    placeholderTextColor="#55526B"
                    value={form.contactDetails?.instagram?.value || ''}
                    onChangeText={val => updateField('contactDetails.instagram.value', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Telegram Username</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="@telegram_handle"
                    placeholderTextColor="#55526B"
                    value={form.contactDetails?.telegram?.value || ''}
                    onChangeText={val => updateField('contactDetails.telegram.value', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tango Handle / ID (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="tango_id"
                    placeholderTextColor="#55526B"
                    value={form.contactDetails?.tango?.value || ''}
                    onChangeText={val => updateField('contactDetails.tango.value', val)}
                  />
                </View>
              </View>

              {/* Pacing & Persuasion Controls */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Conversation Pacing before Pitch</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Min Messages Before Pitch</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={String(form.moveOffAppMinMessages ?? 3)}
                    onChangeText={v => updateField('moveOffAppMinMessages', parseInt(v, 10) || 1)}
                  />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Max Messages Before Pitch</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={String(form.moveOffAppMaxMessages ?? 8)}
                    onChangeText={v => updateField('moveOffAppMaxMessages', parseInt(v, 10) || 8)}
                  />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Max Persuasion Attempts</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={String(form.moveOffAppMaxPersuasion ?? 2)}
                    onChangeText={v => updateField('moveOffAppMaxPersuasion', parseInt(v, 10) || 2)}
                  />
                </View>
              </View>

              {/* Stop Conditions */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Goal Completion Limits</Text>
                <View style={styles.toggleRow}>
                  <Text style={styles.labelMuted}>Pause Automation when Goal Reached</Text>
                  <Switch
                    value={form.stopAfterGoalEnabled !== false}
                    onValueChange={v => updateField('stopAfterGoalEnabled', v)}
                    trackColor={{ false: '#26223B', true: '#FE3C72' }}
                    thumbColor={form.stopAfterGoalEnabled !== false ? '#FFF' : '#716E89'}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CARD 2: SWIPING & SAFETY LIMITS ════════════════════ */}
        <View style={[styles.v2Card, openCards.swiping && styles.v2CardOpen]}>
          <TouchableOpacity
            style={styles.v2CardHeader}
            onPress={() => toggleCard('swiping')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="heart-outline" size={17} color="#FE3C72" />
              <Text style={styles.v2CardTitle}>Swiping</Text>
            </View>
            <Ionicons
              name={openCards.swiping ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8E8DA3"
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.swiping && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="flash" size={11} color="#FE3C72" />
                <Text style={styles.v2ChipText}>{getSwipingSummary().likes}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="time-outline" size={11} color="#818CF8" />
                <Text style={styles.v2ChipText}>{getSwipingSummary().pacing}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>{getSwipingSummary().age}</Text>
              </View>
            </View>
          )}

          {/* Expanded Body */}
          {openCards.swiping && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Control swipe batches, cooldown pacing & profile filters:</Text>

              {/* Batch Limits */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Execution Batch Limits</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Likes per Cycle</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={String(form.likesPerCycle ?? 50)}
                    onChangeText={v => updateField('likesPerCycle', parseInt(v, 10) || 20)}
                  />
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Cycle Cooldown Delay (minutes)</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={String(form.scheduleInterval ?? 30)}
                    onChangeText={v => updateField('scheduleInterval', parseInt(v, 10) || 30)}
                  />
                </View>
              </View>

              {/* Age Filter */}
              <View style={styles.subBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.toggleTitle}>Age Range Filter</Text>
                  <Switch
                    value={form.ageFilter?.enabled === true}
                    onValueChange={v => updateField('ageFilter.enabled', v)}
                    trackColor={{ false: '#26223B', true: '#10B981' }}
                    thumbColor={form.ageFilter?.enabled ? '#FFF' : '#716E89'}
                  />
                </View>
                {form.ageFilter?.enabled && (
                  <View style={[styles.rowBetween, { marginTop: 10 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.inputLabel}>Min Age</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(form.ageFilter?.min ?? 20)}
                        onChangeText={v => updateField('ageFilter.min', parseInt(v, 10) || 18)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.inputLabel}>Max Age</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(form.ageFilter?.max ?? 35)}
                        onChangeText={v => updateField('ageFilter.max', parseInt(v, 10) || 45)}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Distance Filter */}
              <View style={styles.subBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.toggleTitle}>Maximum Distance Limit</Text>
                  <Switch
                    value={form.distanceFilter?.enabled === true}
                    onValueChange={v => updateField('distanceFilter.enabled', v)}
                    trackColor={{ false: '#26223B', true: '#818CF8' }}
                    thumbColor={form.distanceFilter?.enabled ? '#FFF' : '#716E89'}
                  />
                </View>
                {form.distanceFilter?.enabled && (
                  <View style={[styles.rowBetween, { marginTop: 10 }]}>
                    <Text style={styles.labelMuted}>Radius Distance</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={styles.smallInput}
                        keyboardType="numeric"
                        value={String(form.distanceFilter?.maxDistance ?? 50)}
                        onChangeText={v => updateField('distanceFilter.maxDistance', parseInt(v, 10) || 50)}
                      />
                      <Text style={{ color: '#8E8DA3', marginLeft: 6, fontSize: 12 }}>km</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CARD 3: MESSAGING ════════════════════ */}
        <View style={[styles.v2Card, openCards.messaging && styles.v2CardOpen]}>
          <TouchableOpacity
            style={styles.v2CardHeader}
            onPress={() => toggleCard('messaging')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="chatbubbles-outline" size={17} color="#EC4899" />
              <Text style={styles.v2CardTitle}>Messaging</Text>
            </View>
            <Ionicons
              name={openCards.messaging ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8E8DA3"
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.messaging && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="color-wand" size={11} color="#EC4899" />
                <Text style={styles.v2ChipText}>{getMessagingSummary().tone}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="time" size={11} color="#818CF8" />
                <Text style={styles.v2ChipText}>{getMessagingSummary().followup}</Text>
              </View>
              {form.consecutiveMessagesEnabled && (
                <View style={styles.v2Chip}>
                  <Text style={styles.v2ChipText}>Double Texting On</Text>
                </View>
              )}
            </View>
          )}

          {/* Expanded Body */}
          {openCards.messaging && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Conversation tone, opening icebreakers & auto follow-ups:</Text>

              {/* 6-Tone Engine Selector */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>6-Tone Conversation Engine</Text>
                <View style={styles.chipRow}>
                  {TONE_OPTIONS.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.chip, (form.tone === t || form.chattingStyle === t) && styles.chipActive]}
                      onPress={() => {
                        updateField('tone', t);
                        updateField('chattingStyle', t);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, (form.tone === t || form.chattingStyle === t) && styles.chipTextActive]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Opener Directive */}
              <View style={styles.subBox}>
                <View style={styles.toggleRow}>
                  <Text style={styles.subBoxTitle}>Custom Opener Prompt Directive</Text>
                  <Switch
                    value={form.promptModes?.intro?.useCustom === true}
                    onValueChange={v => updateField('promptModes.intro.useCustom', v)}
                    trackColor={{ false: '#26223B', true: '#EC4899' }}
                    thumbColor={form.promptModes?.intro?.useCustom ? '#FFF' : '#716E89'}
                  />
                </View>
                {form.promptModes?.intro?.useCustom && (
                  <TextInput
                    style={styles.textArea}
                    multiline={true}
                    placeholder="Tell the AI how to compose the first message..."
                    placeholderTextColor="#55526B"
                    value={form.promptModes?.intro?.customPrompt || ''}
                    onChangeText={val => updateField('promptModes.intro.customPrompt', val)}
                  />
                )}
              </View>

              {/* Automated Follow-Up Mode */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Automated Follow-Up (When no reply)</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Delay before sending follow-up</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="numeric"
                      value={String(form.promptModes?.followup?.delay || '24')}
                      onChangeText={v => updateField('promptModes.followup.delay', v)}
                    />
                    <Text style={{ color: '#8E8DA3', marginLeft: 6, fontSize: 12 }}>hours</Text>
                  </View>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.labelMuted}>Max Retry Attempts</Text>
                  <TextInput
                    style={styles.smallInput}
                    keyboardType="numeric"
                    value={String(form.promptModes?.followup?.maxAttempts || '2')}
                    onChangeText={v => updateField('promptModes.followup.maxAttempts', v)}
                  />
                </View>
              </View>

              {/* Consecutive Messages Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.toggleTitle}>Double Texting (Consecutive Messages)</Text>
                  <Text style={styles.toggleSub}>Allow follow-up messages even without reply</Text>
                </View>
                <Switch
                  value={form.consecutiveMessagesEnabled === true}
                  onValueChange={v => updateField('consecutiveMessagesEnabled', v)}
                  trackColor={{ false: '#26223B', true: '#EC4899' }}
                  thumbColor={form.consecutiveMessagesEnabled ? '#FFF' : '#716E89'}
                />
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CARD 4: YOUR CHAT STYLE & AI TRAINING ════════════════════ */}
        <View style={[styles.v2Card, openCards.style && styles.v2CardOpen]}>
          <TouchableOpacity
            style={styles.v2CardHeader}
            onPress={() => toggleCard('style')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="person-outline" size={17} color="#C026D3" />
              <Text style={styles.v2CardTitle}>Your Chat Style</Text>
            </View>
            <Ionicons
              name={openCards.style ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8E8DA3"
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.style && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="male-female" size={11} color="#C026D3" />
                <Text style={styles.v2ChipText}>{getStyleSummary().gender}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>{getStyleSummary().length}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Text style={styles.v2ChipText}>{form.manualBio ? 'Custom Bio Active' : 'Default Bio'}</Text>
              </View>
            </View>
          )}

          {/* Expanded Body */}
          {openCards.style && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Personalize how the AI speaks about you and responds:</Text>

              {/* Gender Override */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>My Gender Persona</Text>
                <View style={styles.chipRow}>
                  {GENDER_OPTIONS.map(g => (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.chip, form.userGenderOverride === g.id && styles.chipActive]}
                      onPress={() => updateField('userGenderOverride', g.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, form.userGenderOverride === g.id && styles.chipTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Interactive AI Chat Style Training Simulator */}
              <View style={styles.subBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.subBoxTitle}>AI Style Training Simulator</Text>
                  <View style={styles.trainerBadge}>
                    <Ionicons name="sparkles" size={11} color="#C026D3" />
                    <Text style={styles.trainerBadgeText}>Few-Shot Model</Text>
                  </View>
                </View>
                <Text style={styles.labelMuted}>
                  Practice chat with virtual match {TRAINING_PERSONA.name} to train the AI on your exact texting rhythm, slang & humor:
                </Text>

                {!trainingActive ? (
                  <TouchableOpacity
                    style={styles.startTrainerBtn}
                    onPress={startTrainingSession}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubbles" size={14} color="#FFF" />
                    <Text style={styles.startTrainerBtnText}>Start Texting Practice with {TRAINING_PERSONA.name}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.simChatBox}>
                    <View style={styles.simChatHeader}>
                      <View style={styles.simAvatar}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 11 }}>M</Text>
                      </View>
                      <Text style={styles.simMatchName}>{TRAINING_PERSONA.name} (Simulated Match)</Text>
                    </View>

                    {/* Messages Container */}
                    <View style={styles.simMessagesList}>
                      {chatMessages.map(msg => (
                        <View
                          key={msg.id}
                          style={[styles.simBubble, msg.sender === 'user' ? styles.simBubbleUser : styles.simBubbleMatch]}
                        >
                          <Text style={[styles.simBubbleText, msg.sender === 'user' && { color: '#FFF' }]}>
                            {msg.text}
                          </Text>
                        </View>
                      ))}
                      {calibrating && (
                        <View style={[styles.simBubble, styles.simBubbleMatch]}>
                          <Text style={{ color: '#8E8DA3', fontSize: 11, fontStyle: 'italic' }}>{TRAINING_PERSONA.name} is typing…</Text>
                        </View>
                      )}
                    </View>

                    {/* Practice Input Bar */}
                    <View style={styles.simInputRow}>
                      <TextInput
                        style={styles.simTextInput}
                        placeholder="Type how you normally text..."
                        placeholderTextColor="#55526B"
                        value={inputPracticeMsg}
                        onChangeText={setInputPracticeMsg}
                      />
                      <TouchableOpacity
                        style={styles.simSendBtn}
                        onPress={sendPracticeMessage}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="arrow-up" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* About Me / Bio Context for AI */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Custom Bio / Persona Context</Text>
                <Text style={styles.labelMuted}>
                  Share your job, hobbies, or background so the AI can answer personal questions accurately:
                </Text>
                <TextInput
                  style={[styles.textArea, { marginTop: 8 }]}
                  multiline={true}
                  placeholder="E.g. I work in tech, love bouldering, travel frequently to Europe, enjoy indie electronic music..."
                  placeholderTextColor="#55526B"
                  value={form.manualBio || ''}
                  onChangeText={val => updateField('manualBio', val)}
                />
              </View>

              {/* Response Length */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Reply Length</Text>
                <View style={styles.chipRow}>
                  {REPLY_LENGTHS.map(rl => (
                    <TouchableOpacity
                      key={rl.id}
                      style={[styles.chip, (form.replyLength === rl.id || (!form.replyLength && rl.id === 'medium')) && styles.chipActive]}
                      onPress={() => updateField('replyLength', rl.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, (form.replyLength === rl.id || (!form.replyLength && rl.id === 'medium')) && styles.chipTextActive]}>
                        {rl.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Emoji Frequency */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>Emoji Frequency</Text>
                <View style={styles.chipRow}>
                  {EMOJI_STYLES.map(es => (
                    <TouchableOpacity
                      key={es.id}
                      style={[styles.chip, (form.useEmoji === es.id || (!form.useEmoji && es.id === 'subtle')) && styles.chipActive]}
                      onPress={() => updateField('useEmoji', es.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, (form.useEmoji === es.id || (!form.useEmoji && es.id === 'subtle')) && styles.chipTextActive]}>
                        {es.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════ CARD 5: AI ACTIVE TIME & SAFETY ════════════════════ */}
        <View style={[styles.v2Card, openCards.activeTime && styles.v2CardOpen]}>
          <TouchableOpacity
            style={styles.v2CardHeader}
            onPress={() => toggleCard('activeTime')}
            activeOpacity={0.85}
          >
            <View style={styles.cardTitleWrap}>
              <Ionicons name="time-outline" size={17} color="#10B981" />
              <Text style={styles.v2CardTitle}>AI Active Time & Safety</Text>
            </View>
            <Ionicons
              name={openCards.activeTime ? "chevron-up" : "chevron-down"}
              size={18}
              color="#8E8DA3"
            />
          </TouchableOpacity>

          {/* Collapsed Summary Chips */}
          {!openCards.activeTime && (
            <View style={styles.collapsedRow}>
              <View style={styles.v2Chip}>
                <Ionicons name="calendar" size={11} color="#10B981" />
                <Text style={styles.v2ChipText}>{getActiveTimeSummary()}</Text>
              </View>
              <View style={styles.v2Chip}>
                <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                <Text style={styles.v2ChipText}>Anti-Ban 50 likes/hr</Text>
              </View>
            </View>
          )}

          {/* Expanded Body */}
          {openCards.activeTime && (
            <View style={styles.v2CardBody}>
              <Text style={styles.fieldDesc}>Anti-ban algorithms and autonomous run schedules:</Text>

              {/* Anti-Ban Rate Limiter */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.toggleTitle}>Anti-Ban Safety Shield</Text>
                  <Text style={styles.toggleSub}>Enforces human rate limits (max 50 likes/hr) to protect account</Text>
                </View>
                <Switch
                  value={form.safetyMode !== false}
                  onValueChange={v => updateField('safetyMode', v)}
                  trackColor={{ false: '#26223B', true: '#10B981' }}
                  thumbColor={form.safetyMode !== false ? '#FFF' : '#716E89'}
                />
              </View>

              {/* Active Hours Presets */}
              <View style={styles.subBox}>
                <Text style={styles.subBoxTitle}>AI Active Schedule Presets</Text>
                <View style={styles.chipRow}>
                  {ACTIVE_HOUR_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, form.activeHours?.preset === p && styles.chipActive]}
                      onPress={() => updateField('activeHours.preset', p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, form.activeHours?.preset === p && styles.chipTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {form.activeHours?.preset === 'Custom' && (
                  <View style={[styles.rowBetween, { marginTop: 12 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.inputLabel}>Start Time (e.g. 09:00)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={form.activeHours?.startTime || '09:00'}
                        onChangeText={v => updateField('activeHours.startTime', v)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.inputLabel}>End Time (e.g. 22:00)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={form.activeHours?.endTime || '22:00'}
                        onChangeText={v => updateField('activeHours.endTime', v)}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Sticky Save & Apply Bar ── */}
      <View style={styles.saveBar}>
        {error && (
          <Text style={styles.errorText}>Error: {error}</Text>
        )}
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
                name={saveSuccess ? "checkmark-circle" : "checkmark-done"}
                size={16}
                color="#FFF"
              />
              <Text style={styles.saveButtonText}>
                {saveSuccess ? 'Saved & Applied to Live Wingman!' : 'Save & Apply to AI Wingman'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
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
    gap: 12,
  },

  // ─── V2 Accordion Cards ───
  v2Card: {
    backgroundColor: '#161424',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26223B',
    overflow: 'hidden',
  },
  v2CardOpen: {
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  v2CardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  v2CardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // ─── Collapsed Summary Chips ───
  collapsedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  v2Chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1C192E',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  v2ChipText: {
    color: '#9E9DB5',
    fontSize: 11,
    fontWeight: '600',
  },

  // ─── Expanded Card Body ───
  v2CardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: '#221E33',
    paddingTop: 12,
  },
  fieldDesc: {
    color: '#8E8DA3',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },

  // ─── Radio Group ───
  radioGroup: {
    gap: 8,
    marginBottom: 12,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#221E33',
  },
  goalOptionSelected: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.06)',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#716E89',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#FE3C72',
  },
  radioInnerCircle: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FE3C72',
  },
  goalOptionLabel: {
    color: '#E0DFEC',
    fontSize: 13,
    fontWeight: '700',
  },
  goalOptionSub: {
    color: '#716E89',
    fontSize: 11,
    marginTop: 1,
  },

  // ─── Sub-Boxes & Inputs ───
  subBox: {
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#221E33',
    marginTop: 10,
  },
  subBoxTitle: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#161424',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  chipActive: {
    backgroundColor: '#FE3C72',
    borderColor: '#FE3C72',
  },
  chipText: {
    color: '#8E8DA3',
    fontSize: 11.5,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  inputGroup: {
    marginTop: 8,
  },
  inputLabel: {
    color: '#8E8DA3',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#161424',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26223B',
    color: '#FFF',
    fontSize: 12.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  textArea: {
    backgroundColor: '#161424',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26223B',
    color: '#FFF',
    fontSize: 12.5,
    padding: 10,
    minHeight: 65,
    textAlignVertical: 'top',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  labelMuted: {
    color: '#8E8DA3',
    fontSize: 12,
  },
  smallInput: {
    backgroundColor: '#161424',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#26223B',
    color: '#FFF',
    fontSize: 12,
    width: 54,
    textAlign: 'center',
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSub: {
    color: '#716E89',
    fontSize: 11,
    marginTop: 1,
  },

  // ─── Style Trainer Simulator ───
  trainerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192, 38, 211, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trainerBadgeText: {
    color: '#C026D3',
    fontSize: 10,
    fontWeight: '800',
  },
  startTrainerBtn: {
    marginTop: 10,
    backgroundColor: '#C026D3',
    borderRadius: 9,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  startTrainerBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  simChatBox: {
    marginTop: 10,
    backgroundColor: '#161424',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 10,
  },
  simChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: '#221E33',
    paddingBottom: 8,
    marginBottom: 8,
  },
  simAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  simMatchName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  simMessagesList: {
    gap: 6,
    marginBottom: 8,
  },
  simBubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: '85%',
  },
  simBubbleMatch: {
    backgroundColor: '#26223B',
    alignSelf: 'flex-start',
  },
  simBubbleUser: {
    backgroundColor: '#FE3C72',
    alignSelf: 'flex-end',
  },
  simBubbleText: {
    color: '#D8D6E8',
    fontSize: 12,
  },
  simInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  simTextInput: {
    flex: 1,
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26223B',
    color: '#FFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  simSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FE3C72',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Sticky Save Bar ───
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
});
