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
  Keyboard,
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

// ── Master Country & Dial Code Registry (Exact 100% Parity with Desktop Plugin) ──
const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Arabic', 'Hindi', 'Chinese', 'Japanese', 'Korean',
  'Turkish', 'Dutch', 'Polish', 'Swedish', 'Ukrainian', 'Hebrew',
  'Persian', 'Romanian', 'Greek', 'Czech', 'Hungarian', 'Thai'
];

const DIAL_CODES = [
  { code: 'AF', dial: '+93',  name: 'Afghanistan',            len: [9,  9]  },
  { code: 'AL', dial: '+355', name: 'Albania',                len: [9,  9]  },
  { code: 'DZ', dial: '+213', name: 'Algeria',                len: [9,  9]  },
  { code: 'AR', dial: '+54',  name: 'Argentina',              len: [10, 10] },
  { code: 'AM', dial: '+374', name: 'Armenia',                len: [8,  8]  },
  { code: 'AU', dial: '+61',  name: 'Australia',              len: [9,  9]  },
  { code: 'AT', dial: '+43',  name: 'Austria',                len: [10, 11] },
  { code: 'AZ', dial: '+994', name: 'Azerbaijan',             len: [9,  9]  },
  { code: 'BD', dial: '+880', name: 'Bangladesh',             len: [10, 10] },
  { code: 'BY', dial: '+375', name: 'Belarus',                len: [9,  9]  },
  { code: 'BE', dial: '+32',  name: 'Belgium',                len: [9,  9]  },
  { code: 'BO', dial: '+591', name: 'Bolivia',                len: [8,  8]  },
  { code: 'BA', dial: '+387', name: 'Bosnia and Herzegovina', len: [8,  8]  },
  { code: 'BR', dial: '+55',  name: 'Brazil',                 len: [10, 11] },
  { code: 'BG', dial: '+359', name: 'Bulgaria',               len: [9,  9]  },
  { code: 'KH', dial: '+855', name: 'Cambodia',               len: [8,  9]  },
  { code: 'CA', dial: '+1',   name: 'Canada',                 len: [10, 10] },
  { code: 'CL', dial: '+56',  name: 'Chile',                  len: [9,  9]  },
  { code: 'CN', dial: '+86',  name: 'China',                  len: [11, 11] },
  { code: 'CO', dial: '+57',  name: 'Colombia',               len: [10, 10] },
  { code: 'HR', dial: '+385', name: 'Croatia',                len: [8,  9]  },
  { code: 'CZ', dial: '+420', name: 'Czech Republic',         len: [9,  9]  },
  { code: 'DK', dial: '+45',  name: 'Denmark',                len: [8,  8]  },
  { code: 'EC', dial: '+593', name: 'Ecuador',                len: [9,  9]  },
  { code: 'EG', dial: '+20',  name: 'Egypt',                  len: [10, 10] },
  { code: 'EE', dial: '+372', name: 'Estonia',                len: [7,  8]  },
  { code: 'ET', dial: '+251', name: 'Ethiopia',               len: [9,  9]  },
  { code: 'FI', dial: '+358', name: 'Finland',                len: [9,  10] },
  { code: 'FR', dial: '+33',  name: 'France',                 len: [9,  9]  },
  { code: 'GE', dial: '+995', name: 'Georgia',                len: [9,  9]  },
  { code: 'DE', dial: '+49',  name: 'Germany',                len: [10, 11] },
  { code: 'GH', dial: '+233', name: 'Ghana',                  len: [9,  9]  },
  { code: 'GR', dial: '+30',  name: 'Greece',                 len: [10, 10] },
  { code: 'GT', dial: '+502', name: 'Guatemala',              len: [8,  8]  },
  { code: 'HU', dial: '+36',  name: 'Hungary',                len: [9,  9]  },
  { code: 'IN', dial: '+91',  name: 'India',                  len: [10, 10] },
  { code: 'ID', dial: '+62',  name: 'Indonesia',              len: [9,  12] },
  { code: 'IR', dial: '+98',  name: 'Iran',                   len: [10, 10] },
  { code: 'IQ', dial: '+964', name: 'Iraq',                   len: [10, 10] },
  { code: 'IE', dial: '+353', name: 'Ireland',                len: [9,  9]  },
  { code: 'IL', dial: '+972', name: 'Israel',                 len: [9,  9]  },
  { code: 'IT', dial: '+39',  name: 'Italy',                  len: [9,  10] },
  { code: 'JP', dial: '+81',  name: 'Japan',                  len: [10, 10] },
  { code: 'JO', dial: '+962', name: 'Jordan',                 len: [9,  9]  },
  { code: 'KZ', dial: '+7',   name: 'Kazakhstan',             len: [10, 10] },
  { code: 'KE', dial: '+254', name: 'Kenya',                  len: [9,  9]  },
  { code: 'XK', dial: '+383', name: 'Kosovo',                 len: [8,  8]  },
  { code: 'KW', dial: '+965', name: 'Kuwait',                 len: [8,  8]  },
  { code: 'LV', dial: '+371', name: 'Latvia',                 len: [8,  8]  },
  { code: 'LB', dial: '+961', name: 'Lebanon',                len: [7,  8]  },
  { code: 'LY', dial: '+218', name: 'Libya',                  len: [9,  9]  },
  { code: 'LT', dial: '+370', name: 'Lithuania',              len: [8,  8]  },
  { code: 'MY', dial: '+60',  name: 'Malaysia',               len: [9,  10] },
  { code: 'MX', dial: '+52',  name: 'Mexico',                 len: [10, 10] },
  { code: 'MD', dial: '+373', name: 'Moldova',                len: [8,  8]  },
  { code: 'MN', dial: '+976', name: 'Mongolia',               len: [8,  8]  },
  { code: 'MA', dial: '+212', name: 'Morocco',                len: [9,  9]  },
  { code: 'NL', dial: '+31',  name: 'Netherlands',            len: [9,  9]  },
  { code: 'NZ', dial: '+64',  name: 'New Zealand',            len: [8,  9]  },
  { code: 'NG', dial: '+234', name: 'Nigeria',                len: [10, 10] },
  { code: 'MK', dial: '+389', name: 'North Macedonia',        len: [8,  8]  },
  { code: 'NO', dial: '+47',  name: 'Norway',                 len: [8,  8]  },
  { code: 'PK', dial: '+92',  name: 'Pakistan',               len: [10, 10] },
  { code: 'PY', dial: '+595', name: 'Paraguay',               len: [9,  9]  },
  { code: 'PE', dial: '+51',  name: 'Peru',                   len: [9,  9]  },
  { code: 'PH', dial: '+63',  name: 'Philippines',            len: [10, 10] },
  { code: 'PL', dial: '+48',  name: 'Poland',                 len: [9,  9]  },
  { code: 'PT', dial: '+351', name: 'Portugal',               len: [9,  9]  },
  { code: 'QA', dial: '+974', name: 'Qatar',                  len: [8,  8]  },
  { code: 'RO', dial: '+40',  name: 'Romania',                len: [9,  9]  },
  { code: 'RU', dial: '+7',   name: 'Russia',                 len: [10, 10] },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',           len: [9,  9]  },
  { code: 'RS', dial: '+381', name: 'Serbia',                 len: [8,  9]  },
  { code: 'SK', dial: '+421', name: 'Slovakia',               len: [9,  9]  },
  { code: 'SI', dial: '+386', name: 'Slovenia',               len: [8,  8]  },
  { code: 'ZA', dial: '+27',  name: 'South Africa',           len: [9,  9]  },
  { code: 'KR', dial: '+82',  name: 'South Korea',            len: [9,  10] },
  { code: 'ES', dial: '+34',  name: 'Spain',                  len: [9,  9]  },
  { code: 'LK', dial: '+94',  name: 'Sri Lanka',              len: [9,  9]  },
  { code: 'SE', dial: '+46',  name: 'Sweden',                 len: [9,  9]  },
  { code: 'CH', dial: '+41',  name: 'Switzerland',            len: [9,  9]  },
  { code: 'SY', dial: '+963', name: 'Syria',                  len: [9,  9]  },
  { code: 'TW', dial: '+886', name: 'Taiwan',                 len: [9,  9]  },
  { code: 'TH', dial: '+66',  name: 'Thailand',               len: [9,  9]  },
  { code: 'TN', dial: '+216', name: 'Tunisia',                len: [8,  8]  },
  { code: 'TR', dial: '+90',  name: 'Turkey',                 len: [10, 10] },
  { code: 'UA', dial: '+380', name: 'Ukraine',                len: [9,  9]  },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates',   len: [9,  9]  },
  { code: 'GB', dial: '+44',  name: 'United Kingdom',         len: [10, 10] },
  { code: 'US', dial: '+1',   name: 'United States',          len: [10, 10] },
  { code: 'UY', dial: '+598', name: 'Uruguay',                len: [8,  8]  },
  { code: 'UZ', dial: '+998', name: 'Uzbekistan',             len: [9,  9]  },
  { code: 'VE', dial: '+58',  name: 'Venezuela',              len: [10, 10] },
  { code: 'VN', dial: '+84',  name: 'Vietnam',                len: [9,  10] },
  { code: 'YE', dial: '+967', name: 'Yemen',                  len: [9,  9]  },
];

const DIAL_EXAMPLES = {
  '+93': '701234567',   '+355': '661234567',  '+213': '551234567',
  '+54': '1123456789',  '+374': '77123456',   '+61': '412345678',
  '+43': '6641234567',  '+994': '501234567',  '+880': '1712345678',
  '+375': '291234567',  '+32': '470123456',   '+591': '71234567',
  '+387': '61123456',   '+55': '11912345678', '+359': '881234567',
  '+855': '12345678',   '+1':  '2015551234',  '+56': '912345678',
  '+86': '13812345678', '+57': '3001234567',  '+385': '91234567',
  '+420': '601123456',  '+45': '20123456',    '+593': '991234567',
  '+20': '1001234567',  '+372': '51234567',   '+251': '911234567',
  '+358': '412345678',  '+33': '612345678',   '+995': '555123456',
  '+49': '15123456789', '+233': '201234567',  '+30': '6912345678',
  '+502': '51234567',   '+36': '201234567',   '+91': '9123456789',
  '+62': '81234567890', '+98': '9123456789',  '+964': '7901234567',
  '+353': '851234567',  '+972': '501234567',  '+39': '3123456789',
  '+81': '9012345678',  '+962': '791234567',  '+7':  '9161234567',
  '+254': '712345678',  '+383': '43123456',   '+965': '51234567',
  '+371': '21234567',   '+961': '3123456',    '+218': '912345678',
  '+370': '61234567',   '+60': '123456789',   '+52': '5512345678',
  '+373': '69123456',   '+976': '88123456',   '+212': '612345678',
  '+31': '612345678',   '+64': '21123456',    '+234': '8012345678',
  '+389': '71234567',   '+47': '41234567',    '+92': '3001234567',
  '+595': '961234567',  '+51': '912345678',   '+63': '9171234567',
  '+48': '512345678',   '+351': '912345678',  '+974': '33123456',
  '+40': '712345678',   '+966': '512345678',  '+381': '641234567',
  '+421': '901234567',  '+386': '31234567',   '+27': '711234567',
  '+82': '1012345678',  '+34': '612345678',   '+94': '712345678',
  '+46': '701234567',   '+41': '791234567',   '+963': '944123456',
  '+886': '912345678',  '+66': '812345678',   '+216': '20123456',
  '+90': '5321234567',  '+380': '501234567',  '+971': '501234567',
  '+44': '7911123456',  '+598': '91234567',   '+998': '901234567',
  '+58': '4121234567',  '+84': '912345678',   '+967': '712345678',
};

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina',
  'Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia','Croatia',
  'Czech Republic','Denmark','Ecuador','Egypt','Estonia','Ethiopia','Finland',
  'France','Georgia','Germany','Ghana','Greece','Guatemala','Hungary','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan',
  'Kazakhstan','Kenya','Kosovo','Kuwait','Latvia','Lebanon','Libya','Lithuania',
  'Malaysia','Mexico','Moldova','Mongolia','Morocco','Netherlands','New Zealand',
  'Nigeria','North Macedonia','Norway','Pakistan','Paraguay','Peru','Philippines',
  'Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia',
  'Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka',
  'Sweden','Switzerland','Syria','Taiwan','Thailand','Tunisia','Turkey',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen',
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
  const totalSteps = 5;

  // ── Step Selections State ──
  const selectedPlatform = 'tinder'; // Tinder-dedicated app
  const [country, setCountry] = useState('United States');
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [dialCode, setDialCode] = useState('+1');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedGoals, setSelectedGoals] = useState(['date', 'phone']);
  const [frequency, setFrequency] = useState(30);
  const [personality, setPersonality] = useState('freestyle');
  const [safeMode, setSafeMode] = useState(true);

  // ── Modals & Search ──
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [dialSearch, setDialSearch] = useState('');
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  // ── Animations ──
  const progressAnim = useRef(new Animated.Value(1 / 5)).current;
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

    if (currentStep === 5) {
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
      // Step 5 Complete -> Route to Auth to save preferences and create account
      safeHaptic('success');
      navigation.replace('Auth', {
        initialMode: 'signup',
        onboardingData: {
          platform: 'tinder',
          country,
          languages: selectedLanguages,
          dialCode,
          whatsapp,
          goals: selectedGoals,
          frequency,
          personality,
          safeMode,
        },
      });
    }
  };

  const handleBack = () => {
    safeHaptic('light');
    if (currentStep > 1) {
      transitionToStep(currentStep - 1);
    }
  };

  // ── Country Selection Handler with Smart Dial Auto-Matching ──
  const handleSelectCountry = (selectedCountryName) => {
    safeHaptic('light');
    setCountry(selectedCountryName);
    const match = DIAL_CODES.find((d) => d.name === selectedCountryName);
    if (match) {
      setDialCode(match.dial);
    }
    setCountryModalVisible(false);
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

  const currentPhoneExample = DIAL_EXAMPLES[dialCode] || '501234567';

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
              {/* STEP 2: ABOUT YOU                                   */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 2 && (
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
                      {(showAllLanguages ? LANGUAGES : LANGUAGES.slice(0, 8)).map((lang) => {
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
                      <TouchableOpacity
                        style={styles.moreLangChip}
                        onPress={() => {
                          safeHaptic('light');
                          setShowAllLanguages(!showAllLanguages);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.moreLangChipText}>
                          {showAllLanguages ? 'Show Less' : `+ ${LANGUAGES.length - 8} More`}
                        </Text>
                        <Ionicons
                          name={showAllLanguages ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color="#FE3C72"
                        />
                      </TouchableOpacity>
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
                        placeholder={currentPhoneExample}
                        placeholderTextColor="#504E64"
                        value={whatsapp}
                        onChangeText={(val) => setWhatsapp(val.replace(/[^0-9]/g, ''))}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Text style={styles.hintText}>No spaces or dashes — just digits.</Text>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 3: WHAT IS YOUR GOAL?                           */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 3 && (
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
              {/* STEP 4: BEHAVIOR & STYLE                             */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 4 && (
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
              {/* STEP 5: YOU'RE ALL SET!                              */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 5 && (
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
                          {selectedPlatform.toUpperCase()} AUTOMATION
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

                    <View style={styles.timelineDivider} />

                    <View style={styles.timelineItem}>
                      <View style={styles.timelineCheck}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      </View>
                      <View style={styles.timelineTextWrap}>
                        <Text style={styles.timelineLabel}>Style & Protection</Text>
                        <Text style={styles.timelineValue}>
                          Every {frequency}m • {personality.toUpperCase()} • {safeMode ? 'Safe Mode Active' : 'Custom Pace'}
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
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setCountryModalVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setCountryModalVisible(false);
                }}
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
                autoCorrect={false}
                returnKeyType="search"
              />
              {Boolean(countrySearch) && (
                <TouchableOpacity onPress={() => setCountrySearch('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color="#716E89" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    country === item && styles.modalListItemSelected,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSelectCountry(item);
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Dial Code Modal ── */}
      <Modal
        visible={dialModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDialModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setDialModalVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Country Code</Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setDialModalVisible(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchWrap}>
              <Ionicons name="search" size={18} color="#716E89" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search country or code..."
                placeholderTextColor="#5A586E"
                value={dialSearch}
                onChangeText={setDialSearch}
                autoCorrect={false}
                returnKeyType="search"
              />
              {Boolean(dialSearch) && (
                <TouchableOpacity onPress={() => setDialSearch('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color="#716E89" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredDialCodes}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    dialCode === item.dial && styles.modalListItemSelected,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
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
        </KeyboardAvoidingView>
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

  // ── Step 2: About You ──
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
  moreLangChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 60, 114, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moreLangChipText: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '700',
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

  // ── Step 3: Goals ──
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

  // ── Step 4: Behavior & Style ──
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

  // ── Step 5: Complete ──
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#161324',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  modalList: {
    flex: 1,
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
