// src/screens/OnboardingScreen.js — 6-Step Onboarding matching Desktop Plugin
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Animated,
  Easing,
  Dimensions,
  Image,
  StatusBar,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Optional safe haptics
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (_) {
  Haptics = null;
}

const safeHaptic = (type) => {
  try {
    if (!Haptics) return;
    if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {}
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const TINDER_IMG = require('../../assets/flirteasy/tinder.jpg');
const BUMBLE_IMG = require('../../assets/flirteasy/bumble.png');

// ── Master Country & Dial Code Registry (Identical to Desktop Plugin) ──
const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'India', 'Spain', 'Italy', 'Brazil', 'Netherlands', 'Sweden',
  'Norway', 'Denmark', 'Switzerland', 'Austria', 'Belgium', 'Poland',
  'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Philippines',
  'Japan', 'South Korea', 'Singapore', 'New Zealand', 'Ireland', 'Portugal',
  'South Africa', 'United Arab Emirates', 'Saudi Arabia', 'Israel', 'Turkey',
  'Thailand', 'Indonesia', 'Malaysia', 'Vietnam', 'Egypt', 'Greece', 'Czech Republic'
];

const DIAL_CODES = [
  { code: 'US', dial: '+1', name: 'United States' },
  { code: 'GB', dial: '+44', name: 'United Kingdom' },
  { code: 'CA', dial: '+1', name: 'Canada' },
  { code: 'AU', dial: '+61', name: 'Australia' },
  { code: 'DE', dial: '+49', name: 'Germany' },
  { code: 'FR', dial: '+33', name: 'France' },
  { code: 'IN', dial: '+91', name: 'India' },
  { code: 'ES', dial: '+34', name: 'Spain' },
  { code: 'IT', dial: '+39', name: 'Italy' },
  { code: 'BR', dial: '+55', name: 'Brazil' },
  { code: 'NL', dial: '+31', name: 'Netherlands' },
  { code: 'SE', dial: '+46', name: 'Sweden' },
  { code: 'CH', dial: '+41', name: 'Switzerland' },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates' },
  { code: 'SG', dial: '+65', name: 'Singapore' },
  { code: 'MX', dial: '+52', name: 'Mexico' },
];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Arabic', 'Hindi', 'Chinese', 'Japanese', 'Korean',
  'Turkish', 'Dutch', 'Polish', 'Swedish', 'Ukrainian', 'Hebrew',
  'Romanian', 'Greek', 'Czech', 'Hungarian', 'Thai'
];

const GOALS = [
  {
    id: 'date',
    title: 'Set up a Date',
    desc: "Detects when it's time to meet up in person.",
    icon: 'calendar-outline',
  },
  {
    id: 'phone',
    title: 'Get Phone Number',
    desc: 'Know when they share their number with you.',
    icon: 'call-outline',
  },
  {
    id: 'social',
    title: 'Get Social Media',
    desc: 'Connect on Instagram, WhatsApp, or Telegram.',
    icon: 'logo-instagram',
  },
  {
    id: 'never_stop',
    title: 'Keep Engaging',
    desc: 'Auto-chat stays active without stopping.',
    icon: 'infinite-outline',
  },
];

const FREQUENCIES = [
  { value: 30, label: 'Every 30m' },
  { value: 60, label: 'Every Hour' },
  { value: 120, label: 'Every 2 Hours' },
];

const PERSONALITIES = [
  { id: 'freestyle', label: 'Freestyle' },
  { id: 'flirty', label: 'Flirty' },
  { id: 'confident', label: 'Confident' },
  { id: 'serious', label: 'Serious' },
  { id: 'gentle', label: 'Gentle' },
];

export default function OnboardingScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // ── Step Selections State ──
  const [selectedPlatform, setSelectedPlatform] = useState('tinder'); // Step 2
  const [country, setCountry] = useState('United States'); // Step 3
  const [selectedLanguages, setSelectedLanguages] = useState(['English']); // Step 3
  const [dialCode, setDialCode] = useState('+1'); // Step 3
  const [whatsapp, setWhatsapp] = useState(''); // Step 3
  const [selectedGoals, setSelectedGoals] = useState(['date', 'phone']); // Step 4
  const [frequency, setFrequency] = useState(30); // Step 5
  const [personality, setPersonality] = useState('freestyle'); // Step 5
  const [safeMode, setSafeMode] = useState(true); // Step 5

  // ── Modals & Search ──
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [dialSearch, setDialSearch] = useState('');

  // ── Animations ──
  const progressAnim = useRef(new Animated.Value(1 / 6)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timelineProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / totalSteps,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (currentStep === 6) {
      Animated.timing(timelineProgress, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [currentStep]);

  // ── Step Navigation ──
  const transitionToStep = (newStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(newStep);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    safeHaptic('light');
    if (currentStep < totalSteps) {
      transitionToStep(currentStep + 1);
    } else {
      // Step 6 Complete -> Route to Auth to save preferences and create account
      safeHaptic('success');
      navigation.replace('Auth');
    }
  };

  const handleBack = () => {
    safeHaptic('light');
    if (currentStep > 1) {
      transitionToStep(currentStep - 1);
    }
  };

  // ── Language Toggle Handler ──
  const toggleLanguage = (lang) => {
    safeHaptic('light');
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  // ── Goal Toggle Handler ──
  const toggleGoal = (goalId) => {
    safeHaptic('light');
    if (goalId === 'never_stop') {
      setSelectedGoals(['never_stop']);
    } else {
      let filtered = selectedGoals.filter((g) => g !== 'never_stop');
      if (filtered.includes(goalId)) {
        if (filtered.length > 1) {
          filtered = filtered.filter((g) => g !== goalId);
        }
      } else {
        if (filtered.length < 3) {
          filtered.push(goalId);
        }
      }
      setSelectedGoals(filtered);
    }
  };

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredDialCodes = DIAL_CODES.filter(
    (d) =>
      d.name.toLowerCase().includes(dialSearch.toLowerCase()) ||
      d.dial.includes(dialSearch)
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Full-Screen Gradient ── */}
      <LinearGradient
        colors={['#1A0A20', '#120818', '#0A0612', '#08070D']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* ── Navigation Header & Progress ── */}
        <View style={styles.header}>
          {currentStep > 1 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerLogoWrap}>
              <Image source={LOGO_IMG} style={styles.headerLogoImg} resizeMode="contain" />
            </View>
          )}

          <Text style={styles.stepCounter}>
            {currentStep} of {totalSteps}
          </Text>

          <TouchableOpacity
            style={styles.headerSignInBtn}
            onPress={() => {
              safeHaptic('light');
              navigation.navigate('Auth');
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.headerSignInText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* ── Progress Bar ── */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        {/* ── Animated Step Viewport ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.stepContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 1: MEET YOUR AI-WINGMAN                         */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 1 && (
                <View>
                  <Text style={styles.stepTitle}>Meet your AI-Wingman</Text>
                  <Text style={styles.stepSubtitle}>
                    FlirtEasy automates the repetitive stuff so you can focus on real connections.
                  </Text>

                  <View style={styles.featureList}>
                    <View style={styles.featureCard}>
                      <View style={styles.featureIconWrap}>
                        <Ionicons name="flash" size={22} color="#FE3C72" />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Smart auto-swiping</Text>
                        <Text style={styles.featureDesc}>Finding matches while you sleep.</Text>
                      </View>
                    </View>

                    <View style={styles.featureCard}>
                      <View style={styles.featureIconWrap}>
                        <Ionicons name="chatbubbles" size={22} color="#A855F7" />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>AI-written messages</Text>
                        <Text style={styles.featureDesc}>The perfect icebreaker, every time.</Text>
                      </View>
                    </View>

                    <View style={styles.featureCard}>
                      <View style={styles.featureIconWrap}>
                        <Ionicons name="flame" size={22} color="#EC4899" />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Goal focused conversations</Text>
                        <Text style={styles.featureDesc}>Moving from chat to a real date.</Text>
                      </View>
                    </View>

                    <View style={styles.featureCard}>
                      <View style={styles.featureIconWrap}>
                        <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Advanced safety protocols</Text>
                        <Text style={styles.featureDesc}>Human-like behavior to keep you safe.</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 2: WHICH APP ARE YOU ON?                        */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 2 && (
                <View>
                  <Text style={styles.stepTitle}>Which app are you on?</Text>
                  <Text style={styles.stepSubtitle}>
                    FlirtEasy works directly inside these apps.
                  </Text>

                  <View style={styles.platformList}>
                    {/* Tinder Card */}
                    <TouchableOpacity
                      style={[
                        styles.platformCard,
                        selectedPlatform === 'tinder' && styles.platformCardSelected,
                      ]}
                      onPress={() => {
                        safeHaptic('light');
                        setSelectedPlatform('tinder');
                      }}
                      activeOpacity={0.85}
                    >
                      <Image source={TINDER_IMG} style={styles.platformImg} />
                      <Text style={styles.platformName}>Tinder</Text>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedPlatform === 'tinder' && styles.radioCircleSelected,
                        ]}
                      >
                        {selectedPlatform === 'tinder' && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Bumble Card */}
                    <TouchableOpacity
                      style={[
                        styles.platformCard,
                        selectedPlatform === 'bumble' && styles.platformCardSelected,
                      ]}
                      onPress={() => {
                        safeHaptic('light');
                        setSelectedPlatform('bumble');
                      }}
                      activeOpacity={0.85}
                    >
                      <Image source={BUMBLE_IMG} style={styles.platformImg} />
                      <Text style={styles.platformName}>Bumble</Text>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedPlatform === 'bumble' && styles.radioCircleSelected,
                        ]}
                      >
                        {selectedPlatform === 'bumble' && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 3: ABOUT YOU                                   */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 3 && (
                <View>
                  <Text style={styles.stepTitle}>About you</Text>
                  <Text style={styles.stepSubtitle}>
                    Your country, languages, and contact info help your AI Wingman write authentic messages.
                  </Text>

                  {/* Country Field */}
                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="globe-outline" size={13} color="#716E89" /> COUNTRY
                    </Text>
                    <TouchableOpacity
                      style={styles.selectTrigger}
                      onPress={() => {
                        safeHaptic('light');
                        setCountryModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.selectTriggerText}>{country}</Text>
                      <Ionicons name="chevron-down" size={18} color="#8E8DA3" />
                    </TouchableOpacity>
                  </View>

                  {/* Native Languages Field */}
                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="language-outline" size={13} color="#716E89" /> NATIVE LANGUAGES
                    </Text>
                    <View style={styles.langChipsContainer}>
                      {LANGUAGES.slice(0, 10).map((lang) => {
                        const isSelected = selectedLanguages.includes(lang);
                        return (
                          <TouchableOpacity
                            key={lang}
                            style={[
                              styles.langChip,
                              isSelected && styles.langChipSelected,
                            ]}
                            onPress={() => toggleLanguage(lang)}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[
                                styles.langChipText,
                                isSelected && styles.langChipTextSelected,
                              ]}
                            >
                              {lang}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={14} color="#FE3C72" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* WhatsApp Number (Optional) */}
                  <View style={styles.fieldSection}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="logo-whatsapp" size={13} color="#10B981" /> WHATSAPP NUMBER{' '}
                      <Text style={{ color: '#5A586E', fontSize: 10 }}>(OPTIONAL)</Text>
                    </Text>
                    <View style={styles.phoneInputWrap}>
                      <TouchableOpacity
                        style={styles.dialCodeBtn}
                        onPress={() => setDialModalVisible(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dialCodeText}>{dialCode}</Text>
                        <Ionicons name="chevron-down" size={14} color="#8E8DA3" />
                      </TouchableOpacity>
                      <View style={styles.dialDivider} />
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="501234567"
                        placeholderTextColor="#504E64"
                        value={whatsapp}
                        onChangeText={setWhatsapp}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Text style={styles.hintText}>No spaces or dashes — just digits.</Text>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 4: WHAT IS YOUR GOAL?                           */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 4 && (
                <View>
                  <Text style={styles.stepTitle}>What is your Goal?</Text>
                  <Text style={styles.stepSubtitle}>
                    Choose your objectives. Your AI-Wingman focuses conversations on these results.
                  </Text>

                  <View style={styles.goalsList}>
                    {GOALS.map((goal) => {
                      const isSelected = selectedGoals.includes(goal.id);
                      return (
                        <TouchableOpacity
                          key={goal.id}
                          style={[
                            styles.goalCard,
                            isSelected && styles.goalCardSelected,
                          ]}
                          onPress={() => toggleGoal(goal.id)}
                          activeOpacity={0.85}
                        >
                          <View
                            style={[
                              styles.goalIconWrap,
                              isSelected && styles.goalIconWrapSelected,
                            ]}
                          >
                            <Ionicons
                              name={goal.icon}
                              size={20}
                              color={isSelected ? '#FE3C72' : '#8E8DA3'}
                            />
                          </View>
                          <View style={styles.goalInfo}>
                            <Text style={styles.goalTitle}>{goal.title}</Text>
                            <Text style={styles.goalDesc}>{goal.desc}</Text>
                          </View>
                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.radioCircleSelected,
                            ]}
                          >
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#FFF" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 5: BEHAVIOR & STYLE                             */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 5 && (
                <View>
                  <Text style={styles.stepTitle}>Behavior & Style</Text>
                  <Text style={styles.stepSubtitle}>
                    Set the personality and pace for your AI-Wingman to ensure every chat feels natural and safe.
                  </Text>

                  <View style={styles.settingsGroup}>
                    {/* Activity Frequency */}
                    <View style={styles.settingCard}>
                      <View style={styles.settingHeader}>
                        <Text style={styles.settingTitle}>Activity Frequency</Text>
                        <Text style={styles.settingDesc}>
                          How often the AI likes profiles and checks for replies.
                        </Text>
                      </View>
                      <View style={styles.segmentRow}>
                        {FREQUENCIES.map((freq) => (
                          <TouchableOpacity
                            key={freq.value}
                            style={[
                              styles.segmentBtn,
                              frequency === freq.value && styles.segmentBtnActive,
                            ]}
                            onPress={() => {
                              safeHaptic('light');
                              setFrequency(freq.value);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.segmentText,
                                frequency === freq.value && styles.segmentTextActive,
                              ]}
                            >
                              {freq.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* AI Personality */}
                    <View style={styles.settingCard}>
                      <View style={styles.settingHeader}>
                        <Text style={styles.settingTitle}>AI Personality</Text>
                        <Text style={styles.settingDesc}>
                          Ensures every message matches your chosen "vibe."
                        </Text>
                      </View>
                      <View style={styles.personalityChipsRow}>
                        {PERSONALITIES.map((p) => {
                          const isSelected = personality === p.id;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[
                                styles.personalityChip,
                                isSelected && styles.personalityChipSelected,
                              ]}
                              onPress={() => {
                                safeHaptic('light');
                                setPersonality(p.id);
                              }}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.personalityChipText,
                                  isSelected && styles.personalityChipTextSelected,
                                ]}
                              >
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Smart Protection */}
                    <View style={styles.settingCard}>
                      <View style={styles.toggleRow}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={styles.settingTitle}>Smart Protection</Text>
                          <Text
                            style={[
                              styles.settingDesc,
                              !safeMode && { color: '#FE3C72', fontWeight: '600' },
                            ]}
                          >
                            {safeMode
                              ? 'Reduces detection risk by enforcing safe, human-like activity limits.'
                              : 'Warning: Limits disabled. Recommended for maximum account safety.'}
                          </Text>
                        </View>
                        <Switch
                          value={safeMode}
                          onValueChange={(val) => {
                            safeHaptic('medium');
                            setSafeMode(val);
                          }}
                          trackColor={{ false: '#3E3B50', true: '#FE3C72' }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 6: YOU'RE ALL SET!                              */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 6 && (
                <View style={{ alignItems: 'center', paddingTop: 10 }}>
                  <View style={styles.successBadge}>
                    <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                  </View>

                  <Text style={styles.stepTitle}>You're All Set!</Text>
                  <Text style={[styles.stepSubtitle, { textAlign: 'center' }]}>
                    Your AI-Wingman is calibrated and ready to start scaling your dating success.
                  </Text>

                  {/* Summary Timeline */}
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineCheck}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      </View>
                      <View style={styles.timelineTextWrap}>
                        <Text style={styles.timelineLabel}>Platform Connected</Text>
                        <Text style={styles.timelineValue}>
                          {selectedPlatform.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.timelineDivider} />

                    <View style={styles.timelineItem}>
                      <View style={styles.timelineCheck}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      </View>
                      <View style={styles.timelineTextWrap}>
                        <Text style={styles.timelineLabel}>Goals Defined</Text>
                        <Text style={styles.timelineValue}>
                          {selectedGoals.map((g) => g.replace('_', ' ')).join(', ')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.timelineDivider} />

                    <View style={styles.timelineItem}>
                      <View style={styles.timelineCheck}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      </View>
                      <View style={styles.timelineTextWrap}>
                        <Text style={styles.timelineLabel}>Profile Configured</Text>
                        <Text style={styles.timelineValue}>
                          {country} ({selectedLanguages.join(', ')})
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Sticky Bottom Footer with CTA ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleNext}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#FE3C72', '#E8245C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              <Text style={styles.continueBtnText}>
                {currentStep === totalSteps ? 'Save & Create Account' : 'Continue'}
              </Text>
              <Ionicons
                name={
                  currentStep === totalSteps
                    ? 'arrow-forward-outline'
                    : 'arrow-forward-outline'
                }
                size={18}
                color="#FFFFFF"
              />
            </LinearGradient>
          </TouchableOpacity>

          {currentStep === totalSteps && (
            <TouchableOpacity
              style={styles.guestFooterBtn}
              onPress={() => {
                safeHaptic('light');
                navigation.replace('PlatformSelect');
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.guestFooterText}>Launch Cockpit as Guest →</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── Country Picker Modal ── */}
      <Modal visible={countryModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => setCountryModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchWrap}>
              <Ionicons name="search" size={18} color="#716E89" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search country..."
                placeholderTextColor="#5A586E"
                value={countrySearch}
                onChangeText={setCountrySearch}
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    country === item && styles.modalListItemSelected,
                  ]}
                  onPress={() => {
                    safeHaptic('light');
                    setCountry(item);
                    setCountryModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalListText,
                      country === item && styles.modalListTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {country === item && (
                    <Ionicons name="checkmark" size={18} color="#FE3C72" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Dial Code Modal ── */}
      <Modal visible={dialModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Country Code</Text>
              <TouchableOpacity
                onPress={() => setDialModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredDialCodes}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    dialCode === item.dial && styles.modalListItemSelected,
                  ]}
                  onPress={() => {
                    safeHaptic('light');
                    setDialCode(item.dial);
                    setDialModalVisible(false);
                  }}
                >
                  <Text style={styles.modalListText}>{item.name}</Text>
                  <Text style={styles.modalDialText}>{item.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08070D',
  },
  safeArea: {
    flex: 1,
  },

  // ── Header & Progress ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#161324',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoImg: {
    width: 24,
    height: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSignInBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(254, 60, 114, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
  },
  headerSignInText: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '800',
  },
  stepCounter: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressBarWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FE3C72',
    borderRadius: 2,
  },

  // ── Body ──
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContainer: {
    width: '100%',
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  stepSubtitle: {
    color: '#8E8DA3',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },

  // ── Step 1: Feature Cards ──
  featureList: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#12101E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    padding: 16,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1A162B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  featureDesc: {
    color: '#8E8DA3',
    fontSize: 12.5,
  },

  // ── Step 2: Platform Cards ──
  platformList: {
    gap: 14,
  },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12101E',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    padding: 16,
  },
  platformCardSelected: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.08)',
  },
  platformImg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 14,
  },
  platformName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#FE3C72',
    backgroundColor: '#FE3C72',
  },

  // ── Step 3: About You ──
  fieldSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#716E89',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141124',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
  },
  selectTriggerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  langChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#141124',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  langChipSelected: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
  },
  langChipText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '700',
  },
  langChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141124',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 12,
  },
  dialCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  dialCodeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dialDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 8,
  },
  phoneInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  hintText: {
    color: '#5A586E',
    fontSize: 11,
    marginTop: 6,
  },

  // ── Step 4: Goals ──
  goalsList: {
    gap: 12,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12101E',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 14,
  },
  goalCardSelected: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.08)',
  },
  goalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#18142A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalIconWrapSelected: {
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
  },
  goalInfo: {
    flex: 1,
    paddingRight: 8,
  },
  goalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  goalDesc: {
    color: '#8E8DA3',
    fontSize: 12,
    lineHeight: 16,
  },

  // ── Step 5: Behavior & Style ──
  settingsGroup: {
    gap: 14,
  },
  settingCard: {
    backgroundColor: '#12101E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    padding: 16,
  },
  settingHeader: {
    marginBottom: 12,
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  settingDesc: {
    color: '#8E8DA3',
    fontSize: 12,
    lineHeight: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#18142A',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#26203D',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  segmentText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  personalityChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personalityChip: {
    backgroundColor: '#18142A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  personalityChipSelected: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
  },
  personalityChipText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '700',
  },
  personalityChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── Step 6: Complete ──
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FE3C72',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  timelineCard: {
    width: '100%',
    backgroundColor: '#12101E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  timelineCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTextWrap: {
    flex: 1,
  },
  timelineLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  timelineValue: {
    color: '#8E8DA3',
    fontSize: 12,
    marginTop: 1,
  },
  timelineDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 4,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  continueBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  continueGradient: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  guestFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  guestFooterText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Modals ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161324',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#100D1C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 14,
  },
  modalSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalListItemSelected: {
    backgroundColor: 'rgba(254, 60, 114, 0.06)',
  },
  modalListText: {
    color: '#D8D6E8',
    fontSize: 15,
    fontWeight: '600',
  },
  modalListTextSelected: {
    color: '#FE3C72',
    fontWeight: '800',
  },
  modalDialText: {
    color: '#8E8DA3',
    fontSize: 14,
    fontWeight: '700',
  },
});
